import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contact } from './entities/contact.entity';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { FilterContactDto } from './dto/filter-contact.dto';
import { UserRole } from '../users/entities/user.entity';
import { ActivationService } from '../activation/activation.service';
import { ActivationActionType } from '../users/enums/activation-action-type.enum';
import { TransactionService } from '../common/services/transaction.service';
import { TransitionEventService } from '../flowbar/services/transition-event.service';
import { TransitionEventType } from '../flowbar/enums/transition-event-type.enum';
import { PipelineStageService } from './services/pipeline-stage.service';
import { PipelineHistoryService } from './services/pipeline-history.service';

@Injectable()
export class ContactsService {
  constructor(
    @InjectRepository(Contact)
    private readonly contactRepository: Repository<Contact>,
    private readonly activationService: ActivationService,
    private readonly transactionService: TransactionService,
    private readonly transitionEventService: TransitionEventService,
    private readonly pipelineStageService: PipelineStageService,
    private readonly pipelineHistoryService: PipelineHistoryService,
  ) {}

  /**
   * Create a new contact and emit lead_created transition event
   *
   * Operations (all atomic within transaction):
   * 1. Get default "new_lead" pipeline stage
   * 2. Create contact record with initial stage
   * 3. Record initial pipeline history (fromStage = null)
   * 4. Create lead_created transition event
   *
   * After transaction commits:
   * 5. Push event to SQS queue (fire-and-forget)
   * 6. Trigger activation check (fire-and-forget)
   */
  async create(
    userId: string,
    createContactDto: CreateContactDto,
  ): Promise<Contact> {
    // Get default "new_lead" stage
    const newLeadStage = await this.pipelineStageService.findByKey('new_lead');

    // Wrap contact creation + pipeline history + transition event in a transaction
    const { savedContact, transitionEvent } =
      await this.transactionService.runInTransaction(async (manager) => {
        // Create and save contact
        const contactRepo = manager.getRepository(Contact);
        const now = new Date();
        const contact = contactRepo.create({
          ...createContactDto,
          userId,
          status: createContactDto.status || 'active',
          currentPipelineStageId: newLeadStage.id,
          pipelineUpdatedAt: now,
          lastActivityAt: now,
        });
        const savedContact = await contactRepo.save(contact);

        // Record initial pipeline history (fromStage = null for initial creation)
        await this.pipelineHistoryService.recordStageChange(
          savedContact.id,
          null, // No previous stage
          newLeadStage.id,
          userId,
          'system',
          'manual', // User created contact manually
          { createdBy: userId },
          manager,
        );

        // Create lead_created transition event
        const transitionEvent = await this.transitionEventService.create(
          {
            contactId: savedContact.id,
            userId,
            eventType: TransitionEventType.LEAD_CREATED,
            source: 'system',
          },
          manager,
        );

        return { savedContact, transitionEvent };
      });

    // Push event to SQS OUTSIDE transaction (fire-and-forget pattern)
    // SQS failures should not rollback the database transaction
    await this.transitionEventService.pushToQueue(transitionEvent);

    // Trigger activation when agent creates their first contact (fire-and-forget)
    await this.activationService.triggerActivation(
      userId,
      ActivationActionType.CONTACT_CREATED,
    );

    // Load and return contact with pipeline stage relation
    const contactWithStage = await this.contactRepository.findOne({
      where: { id: savedContact.id },
      relations: ['currentPipelineStage'],
    });
    return contactWithStage!; // Safe since we just created it
  }

  async findAll(
    userId: string,
    userRole: UserRole,
    filters: FilterContactDto,
  ): Promise<Contact[]> {
    const queryBuilder = this.contactRepository.createQueryBuilder('contact');

    // Permission-based filtering
    if (userRole === UserRole.AGENT) {
      queryBuilder.where('contact.userId = :userId', { userId });
    }
    // Admin and Super Admin can see all contacts (no additional filter)

    // Apply pipeline stage filters
    if (filters.pipelineStageId) {
      queryBuilder.andWhere('contact.currentPipelineStageId = :stageId', {
        stageId: filters.pipelineStageId,
      });
    }

    // Filter by stage key (requires lookup)
    if (filters.pipelineStageKey) {
      const stage = await this.pipelineStageService.findByKey(
        filters.pipelineStageKey,
      );
      queryBuilder.andWhere('contact.currentPipelineStageId = :stageId', {
        stageId: stage.id,
      });
    }

    if (filters.status) {
      queryBuilder.andWhere('contact.status = :status', {
        status: filters.status,
      });
    }

    if (filters.search) {
      queryBuilder.andWhere(
        '(contact.name ILIKE :search OR contact.email ILIKE :search OR contact.phone ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    // Load pipeline stage relation
    queryBuilder.leftJoinAndSelect(
      'contact.currentPipelineStage',
      'currentPipelineStage',
    );

    queryBuilder.orderBy('contact.createdAt', 'DESC');

    // Apply pagination
    const { limit = 5, offset = 0 } = filters;
    queryBuilder.skip(offset).take(limit);

    return queryBuilder.getMany();
  }

  async findOne(
    contactId: string,
    userId: string,
    userRole: UserRole,
  ): Promise<Contact> {
    const contact = await this.contactRepository.findOne({
      where: { id: contactId },
      relations: ['currentPipelineStage'],
    });

    if (!contact) {
      throw new NotFoundException(`Contact with ID ${contactId} not found`);
    }

    if (!this.canAccessContact(contact, userId, userRole)) {
      throw new ForbiddenException(
        'You do not have permission to access this contact',
      );
    }

    return contact;
  }

  async update(
    contactId: string,
    userId: string,
    userRole: UserRole,
    updateContactDto: UpdateContactDto,
  ): Promise<Contact> {
    const contact = await this.findOne(contactId, userId, userRole);

    Object.assign(contact, updateContactDto);

    // Always update lastActivityAt on any contact update
    contact.lastActivityAt = new Date();

    await this.contactRepository.save(contact);

    // Return contact with pipeline stage relation loaded
    const updatedContact = await this.contactRepository.findOne({
      where: { id: contactId },
      relations: ['currentPipelineStage'],
    });
    return updatedContact!; // Safe since we just saved it
  }

  async remove(
    contactId: string,
    userId: string,
    userRole: UserRole,
  ): Promise<void> {
    const contact = await this.findOne(contactId, userId, userRole);
    await this.contactRepository.remove(contact);
  }

  /**
   * Update contact's pipeline stage
   *
   * Validates access, stage validity, and records change history.
   * All operations are atomic within a transaction.
   *
   * @param contactId - UUID of contact
   * @param userId - UUID of requesting user
   * @param userRole - Role of requesting user
   * @param newStageId - UUID of new pipeline stage
   * @param changedBy - Actor type (user/system/mia)
   * @param reason - Change mechanism (manual/automation/ai_suggested)
   * @param metadata - Additional context
   * @returns Updated contact with currentPipelineStage relation loaded
   */
  async updatePipelineStage(
    contactId: string,
    userId: string,
    userRole: UserRole,
    newStageId: string,
    changedBy: 'user' | 'system' | 'mia' = 'user',
    reason: 'manual' | 'automation' | 'ai_suggested' = 'manual',
    metadata?: any,
  ): Promise<Contact> {
    // Validate access
    const contact = await this.findOne(contactId, userId, userRole);

    // Validate new stage exists and is active
    const newStage = await this.pipelineStageService.findById(newStageId);
    if (!newStage.active) {
      throw new BadRequestException('Cannot move to inactive stage');
    }

    const oldStageId = contact.currentPipelineStageId;

    // Skip if no change
    if (oldStageId === newStageId) {
      const contactWithStage = await this.contactRepository.findOne({
        where: { id: contactId },
        relations: ['currentPipelineStage'],
      });
      return contactWithStage!; // Safe since we just validated contact exists
    }

    // Update contact and record history atomically
    return this.transactionService.runInTransaction(async (manager) => {
      const contactRepo = manager.getRepository(Contact);
      const now = new Date();

      // Update contact
      contact.currentPipelineStageId = newStageId;
      contact.pipelineUpdatedAt = now;
      contact.lastActivityAt = now;
      await contactRepo.save(contact);

      // Record history
      await this.pipelineHistoryService.recordStageChange(
        contactId,
        oldStageId,
        newStageId,
        contact.userId, // Use contact's owner, not requesting user
        changedBy,
        reason,
        metadata || { updatedBy: userId },
        manager,
      );

      // TODO: Trigger automations based on stage change
      // - Check if newStage has automation rules
      // - Create tasks, update cadences, etc.

      // Return contact with relation loaded
      const updatedContact = await contactRepo.findOne({
        where: { id: contactId },
        relations: ['currentPipelineStage'],
      });
      return updatedContact!; // Safe since we just saved it
    });
  }

  private canAccessContact(
    contact: Contact,
    userId: string,
    userRole: UserRole,
  ): boolean {
    if (userRole === UserRole.ADMIN || userRole === UserRole.SUPER_ADMIN) {
      return true;
    }

    if (userRole === UserRole.AGENT) {
      return contact.userId === userId;
    }

    return false;
  }
}