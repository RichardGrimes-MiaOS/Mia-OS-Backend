import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PipelineStage } from '../entities/pipeline-stage.entity';

/**
 * PipelineStageService
 *
 * Manages pipeline stage configuration and queries.
 * Provides methods for CRUD operations on stages.
 */
@Injectable()
export class PipelineStageService {
  constructor(
    @InjectRepository(PipelineStage)
    private readonly pipelineStageRepository: Repository<PipelineStage>,
  ) {}

  /**
   * Find all pipeline stages
   *
   * @param businessType - Filter by business type (default: 'insurance')
   * @param activeOnly - Return only active stages (default: true)
   * @returns Array of pipeline stages ordered by order field
   */
  async findAll(
    businessType: string = 'insurance',
    activeOnly: boolean = true,
  ): Promise<PipelineStage[]> {
    const query = this.pipelineStageRepository
      .createQueryBuilder('stage')
      .where('stage.businessType = :businessType', { businessType })
      .orderBy('stage.order', 'ASC');

    if (activeOnly) {
      query.andWhere('stage.active = :active', { active: true });
    }

    return query.getMany();
  }

  /**
   * Find pipeline stage by key
   *
   * Used for programmatic access to stages (e.g., 'new_lead', 'contacted')
   *
   * @param key - Unique stage key
   * @returns Pipeline stage
   * @throws NotFoundException if stage not found
   */
  async findByKey(key: string): Promise<PipelineStage> {
    const stage = await this.pipelineStageRepository.findOne({
      where: { key },
    });

    if (!stage) {
      throw new NotFoundException(`Pipeline stage with key '${key}' not found`);
    }

    return stage;
  }

  /**
   * Find pipeline stage by ID
   *
   * @param id - Stage UUID
   * @returns Pipeline stage
   * @throws NotFoundException if stage not found
   */
  async findById(id: string): Promise<PipelineStage> {
    const stage = await this.pipelineStageRepository.findOne({
      where: { id },
    });

    if (!stage) {
      throw new NotFoundException(`Pipeline stage with id '${id}' not found`);
    }

    return stage;
  }

  /**
   * Create new pipeline stage
   *
   * Admin-only operation to add custom stages
   *
   * @param dto - Stage creation data
   * @returns Created pipeline stage
   * @throws BadRequestException if key already exists
   */
  async create(dto: {
    name: string;
    key: string;
    order: number;
    isTerminal?: boolean;
    businessType?: string;
    active?: boolean;
  }): Promise<PipelineStage> {
    // Check if key already exists
    const existing = await this.pipelineStageRepository.findOne({
      where: { key: dto.key },
    });

    if (existing) {
      throw new BadRequestException(
        `Pipeline stage with key '${dto.key}' already exists`,
      );
    }

    const stage = this.pipelineStageRepository.create({
      name: dto.name,
      key: dto.key,
      order: dto.order,
      isTerminal: dto.isTerminal ?? false,
      businessType: dto.businessType ?? 'insurance',
      active: dto.active ?? true,
    });

    return this.pipelineStageRepository.save(stage);
  }

  /**
   * Update pipeline stage
   *
   * Admin-only operation to modify stage configuration
   *
   * @param id - Stage UUID
   * @param dto - Updated stage data
   * @returns Updated pipeline stage
   * @throws NotFoundException if stage not found
   * @throws BadRequestException if key conflict
   */
  async update(
    id: string,
    dto: {
      name?: string;
      key?: string;
      order?: number;
      isTerminal?: boolean;
      businessType?: string;
      active?: boolean;
    },
  ): Promise<PipelineStage> {
    const stage = await this.findById(id);

    // If updating key, check for conflicts
    if (dto.key && dto.key !== stage.key) {
      const existing = await this.pipelineStageRepository.findOne({
        where: { key: dto.key },
      });

      if (existing) {
        throw new BadRequestException(
          `Pipeline stage with key '${dto.key}' already exists`,
        );
      }
    }

    // Update fields
    if (dto.name !== undefined) stage.name = dto.name;
    if (dto.key !== undefined) stage.key = dto.key;
    if (dto.order !== undefined) stage.order = dto.order;
    if (dto.isTerminal !== undefined) stage.isTerminal = dto.isTerminal;
    if (dto.businessType !== undefined) stage.businessType = dto.businessType;
    if (dto.active !== undefined) stage.active = dto.active;

    return this.pipelineStageRepository.save(stage);
  }

  /**
   * Deactivate pipeline stage (soft delete)
   *
   * Sets active=false to prevent new contacts from using this stage
   * Existing contacts in this stage are unaffected
   *
   * @param id - Stage UUID
   * @returns Deactivated pipeline stage
   * @throws NotFoundException if stage not found
   */
  async deactivate(id: string): Promise<PipelineStage> {
    const stage = await this.findById(id);
    stage.active = false;
    return this.pipelineStageRepository.save(stage);
  }

  /**
   * Reorder pipeline stages
   *
   * Bulk update of stage order values
   *
   * @param updates - Array of {id, order} pairs
   * @returns Updated stages
   */
  async reorder(
    updates: Array<{ id: string; order: number }>,
  ): Promise<PipelineStage[]> {
    const stages: PipelineStage[] = [];

    for (const update of updates) {
      const stage = await this.findById(update.id);
      stage.order = update.order;
      stages.push(await this.pipelineStageRepository.save(stage));
    }

    return stages;
  }
}
