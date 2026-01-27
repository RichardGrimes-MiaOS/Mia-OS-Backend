import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { PipelineHistory } from '../entities/pipeline-history.entity';

/**
 * PipelineHistoryService
 *
 * Manages pipeline stage change history (append-only audit trail).
 * Implements event sourcing pattern for complete tracking of all stage transitions.
 */
@Injectable()
export class PipelineHistoryService {
  constructor(
    @InjectRepository(PipelineHistory)
    private readonly pipelineHistoryRepository: Repository<PipelineHistory>,
  ) {}

  /**
   * Record a pipeline stage change
   *
   * Creates an immutable history record for audit trail.
   * This method should be called within a transaction for atomicity.
   *
   * @param contactId - UUID of contact
   * @param fromStageId - Previous stage ID (null for initial creation)
   * @param toStageId - New stage ID
   * @param userId - UUID of user who owns the contact
   * @param changedBy - Actor type (user/system/mia)
   * @param reason - Change mechanism (manual/automation/ai_suggested)
   * @param metadata - Additional context (JSONB)
   * @param manager - Optional EntityManager for transaction support
   * @returns Created history record
   */
  async recordStageChange(
    contactId: string,
    fromStageId: string | null,
    toStageId: string,
    userId: string,
    changedBy: 'user' | 'system' | 'mia',
    reason: 'manual' | 'automation' | 'ai_suggested',
    metadata?: any,
    manager?: EntityManager,
  ): Promise<PipelineHistory> {
    const repo = manager
      ? manager.getRepository(PipelineHistory)
      : this.pipelineHistoryRepository;

    const historyRecord = repo.create({
      contactId,
      fromStageId: fromStageId || undefined, // Convert null to undefined for TypeORM
      toStageId,
      userId,
      changedBy,
      reason,
      metadata: metadata || undefined,
    });

    return repo.save(historyRecord);
  }

  /**
   * Get pipeline stage change history for a contact
   *
   * Returns full timeline of stage transitions with stage details loaded.
   * Ordered by creation time (oldest first).
   *
   * @param contactId - UUID of contact
   * @returns Array of history records with relations
   */
  async getContactHistory(contactId: string): Promise<PipelineHistory[]> {
    return this.pipelineHistoryRepository.find({
      where: { contactId },
      relations: ['fromStage', 'toStage', 'user'],
      order: { createdAt: 'ASC' }, // Chronological order
    });
  }

  /**
   * Get pipeline stage change history for a user
   *
   * Returns all stage changes across all contacts owned by user.
   * Useful for analytics and user activity tracking.
   *
   * @param userId - UUID of user
   * @param limit - Max number of records (default: 100)
   * @param offset - Pagination offset (default: 0)
   * @returns Array of history records with relations
   */
  async getUserHistory(
    userId: string,
    limit: number = 100,
    offset: number = 0,
  ): Promise<PipelineHistory[]> {
    return this.pipelineHistoryRepository.find({
      where: { userId },
      relations: ['fromStage', 'toStage', 'contact'],
      order: { createdAt: 'DESC' }, // Most recent first
      take: limit,
      skip: offset,
    });
  }
}
