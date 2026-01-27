import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PipelineStage } from '../entities/pipeline-stage.entity';

/**
 * PipelineStageSeedingService
 *
 * Handles initial data population for default pipeline stages.
 * Seeds the 7 default stages for insurance business type.
 */
@Injectable()
export class PipelineStageSeedingService {
  constructor(
    @InjectRepository(PipelineStage)
    private readonly pipelineStageRepository: Repository<PipelineStage>,
  ) {}

  /**
   * Seed default pipeline stages
   *
   * Creates the 7 default stages for insurance pipeline:
   * 1. New Lead
   * 2. Contacted
   * 3. Qualified
   * 4. Appointment Set
   * 5. In Progress
   * 6. Closed / Won (terminal)
   * 7. Closed / Lost (terminal)
   *
   * Uses upsert logic to avoid duplicates on repeated calls.
   */
  async seedDefaultStages(): Promise<void> {
    const defaultStages = [
      {
        key: 'new_lead',
        name: 'New Lead',
        order: 1,
        isTerminal: false,
        businessType: 'insurance',
        active: true,
      },
      {
        key: 'contacted',
        name: 'Contacted',
        order: 2,
        isTerminal: false,
        businessType: 'insurance',
        active: true,
      },
      {
        key: 'qualified',
        name: 'Qualified',
        order: 3,
        isTerminal: false,
        businessType: 'insurance',
        active: true,
      },
      {
        key: 'appointment_set',
        name: 'Appointment Set',
        order: 4,
        isTerminal: false,
        businessType: 'insurance',
        active: true,
      },
      {
        key: 'in_progress',
        name: 'In Progress',
        order: 5,
        isTerminal: false,
        businessType: 'insurance',
        active: true,
      },
      {
        key: 'closed_won',
        name: 'Closed / Won',
        order: 6,
        isTerminal: true,
        businessType: 'insurance',
        active: true,
      },
      {
        key: 'closed_lost',
        name: 'Closed / Lost',
        order: 7,
        isTerminal: true,
        businessType: 'insurance',
        active: true,
      },
    ];

    for (const stageData of defaultStages) {
      // Check if stage already exists
      const existing = await this.pipelineStageRepository.findOne({
        where: { key: stageData.key },
      });

      if (!existing) {
        // Create new stage
        const stage = this.pipelineStageRepository.create(stageData);
        await this.pipelineStageRepository.save(stage);
        console.log(`[PipelineStageSeedingService] Created stage: ${stageData.name}`);
      } else {
        // Update existing stage (in case name/order changed)
        existing.name = stageData.name;
        existing.order = stageData.order;
        existing.isTerminal = stageData.isTerminal;
        existing.businessType = stageData.businessType;
        existing.active = stageData.active;
        await this.pipelineStageRepository.save(existing);
        console.log(`[PipelineStageSeedingService] Updated stage: ${stageData.name}`);
      }
    }

    console.log('[PipelineStageSeedingService] Default stages seeding completed');
  }
}
