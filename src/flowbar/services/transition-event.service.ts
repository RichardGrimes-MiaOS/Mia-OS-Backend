import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { TransitionEvent } from '../entities/transition-event.entity';
import { TransitionEventType } from '../enums/transition-event-type.enum';
import { SQSService } from '../../common/services/sqs.service';

/**
 * DTO for creating a transition event
 */
export interface CreateTransitionEventDto {
  contactId: string;
  userId: string;
  eventType: TransitionEventType;
  source?: string | null;
  channel?: string | null;
  payload?: Record<string, any> | null;
  occurredAt?: Date;
}

/**
 * TransitionEventService
 *
 * Manages transition events that track contact lifecycle through the Flow Bar.
 * Each event represents a milestone in the sales pipeline.
 *
 * Key behaviors:
 * - Creates events with UNIQUE(contact_id, event_type) constraint
 * - Supports transaction participation via optional EntityManager
 * - Pushes events to SQS for async processing (after transaction commits)
 *
 * Usage pattern:
 * 1. Call create() within a transaction to insert the event
 * 2. After transaction commits, call pushToQueue() to notify downstream systems
 */
@Injectable()
export class TransitionEventService {
  private readonly logger = new Logger(TransitionEventService.name);

  constructor(
    @InjectRepository(TransitionEvent)
    private readonly transitionEventRepository: Repository<TransitionEvent>,
    private readonly sqsService: SQSService,
  ) {}

  // ==================== READ OPERATIONS ====================

  /**
   * Find all transition events for a contact
   */
  async findByContactId(contactId: string): Promise<TransitionEvent[]> {
    return await this.transitionEventRepository.find({
      where: { contactId },
      order: { occurredAt: 'ASC' },
    });
  }

  /**
   * Find a specific event type for a contact
   */
  async findByContactAndType(
    contactId: string,
    eventType: TransitionEventType,
  ): Promise<TransitionEvent | null> {
    return await this.transitionEventRepository.findOne({
      where: { contactId, eventType },
    });
  }

  /**
   * Check if an event type exists for a contact
   */
  async hasEvent(
    contactId: string,
    eventType: TransitionEventType,
  ): Promise<boolean> {
    const event = await this.findByContactAndType(contactId, eventType);
    return event !== null;
  }

  // ==================== WRITE OPERATIONS ====================

  /**
   * Create a transition event (within transaction)
   *
   * @param dto - Event data
   * @param manager - Optional EntityManager for transaction participation
   * @returns Created transition event
   * @throws ConflictException if event type already exists for contact
   *
   * @example
   * // Within a transaction
   * const event = await this.transitionEventService.create({
   *   contactId: contact.id,
   *   userId: contact.userId,
   *   eventType: TransitionEventType.LEAD_CREATED,
   *   source: 'system',
   * }, manager);
   */
  async create(
    dto: CreateTransitionEventDto,
    manager?: EntityManager,
  ): Promise<TransitionEvent> {
    const repo = manager
      ? manager.getRepository(TransitionEvent)
      : this.transitionEventRepository;

    // Check if event already exists (unique constraint would catch this, but better UX to check first)
    const existing = await repo.findOne({
      where: { contactId: dto.contactId, eventType: dto.eventType },
    });

    if (existing) {
      throw new ConflictException(
        `Event ${dto.eventType} already exists for contact ${dto.contactId}`,
      );
    }

    const event = repo.create({
      contactId: dto.contactId,
      userId: dto.userId,
      eventType: dto.eventType,
      source: dto.source ?? null,
      channel: dto.channel ?? null,
      payload: dto.payload ?? null,
      occurredAt: dto.occurredAt ?? new Date(),
    });

    const saved = await repo.save(event);

    this.logger.log(
      `Created ${dto.eventType} event for contact ${dto.contactId}`,
    );

    return saved;
  }

  // ==================== QUEUE OPERATIONS ====================

  /**
   * Push a transition event to SQS queue
   *
   * Call this AFTER the database transaction commits to ensure consistency.
   * SQS push is fire-and-forget - failures are logged but don't throw.
   *
   * @param event - The transition event to push
   * @returns SQS message ID, or null if push failed/skipped
   *
   * @example
   * // After transaction commits
   * await this.transitionEventService.pushToQueue(event);
   */
  async pushToQueue(event: TransitionEvent): Promise<string | null> {
    const queueUrl = process.env.TRANSITION_EVENTS_QUEUE_URL || '';

    return await this.sqsService.sendMessage({
      queueUrl,
      body: {
        eventId: event.id,
        contactId: event.contactId,
        userId: event.userId,
        eventType: event.eventType,
        occurredAt: event.occurredAt.toISOString(),
        source: event.source,
        channel: event.channel,
        payload: event.payload,
      },
      attributes: {
        eventType: event.eventType,
        contactId: event.contactId,
        userId: event.userId,
      },
    });
  }

  /**
   * Create a transition event and push to queue
   *
   * Convenience method that combines create + pushToQueue.
   * Use this when NOT in a transaction context.
   *
   * @param dto - Event data
   * @returns Created transition event
   */
  async createAndPush(dto: CreateTransitionEventDto): Promise<TransitionEvent> {
    const event = await this.create(dto);
    await this.pushToQueue(event);
    return event;
  }
}