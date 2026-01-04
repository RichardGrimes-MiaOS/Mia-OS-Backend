import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { LicensingTraining } from '../entities/licensing-training.entity';
import { CreateLicensingTrainingDto } from '../dto/create-licensing-training.dto';
import { UpdateLicensingTrainingDto } from '../dto/update-licensing-training.dto';

@Injectable()
export class LicensingTrainingService {
  private readonly logger = new Logger(LicensingTrainingService.name);

  constructor(
    @InjectRepository(LicensingTraining)
    private readonly licensingTrainingRepository: Repository<LicensingTraining>,
  ) {}

  /**
   * Find training record by user ID or throw NotFoundException
   */
  async findByUserIdOrFail(userId: string): Promise<LicensingTraining> {
    const training = await this.licensingTrainingRepository.findOne({
      where: { userId },
    });
    if (!training) {
      throw new NotFoundException('Licensing training record not found');
    }
    return training;
  }

  /**
   * Find training record by user ID with relations or throw NotFoundException
   */
  async findByUserIdWithRelationsOrFail(
    userId: string,
  ): Promise<LicensingTraining> {
    const training = await this.licensingTrainingRepository.findOne({
      where: { userId },
      relations: ['user'],
    });
    if (!training) {
      throw new NotFoundException('Licensing training record not found');
    }
    return training;
  }

  /**
   * Create a new licensing training record
   *
   * @param userId - User ID to create training for
   * @param dto - Training data
   * @param manager - Optional EntityManager for transaction support
   * @throws ConflictException if training record already exists
   */
  async create(
    userId: string,
    dto: CreateLicensingTrainingDto,
    manager?: EntityManager,
  ): Promise<LicensingTraining> {
    const repo = manager
      ? manager.getRepository(LicensingTraining)
      : this.licensingTrainingRepository;

    // Check if training record already exists
    const existing = await repo.findOne({ where: { userId } });
    if (existing) {
      throw new ConflictException('Licensing training record already exists');
    }

    // Validate: if isRegistered is true, examfxEmail and registrationScreenshot are optional but recommended
    if (dto.isRegistered && !dto.examfxEmail && !dto.registrationScreenshot) {
      this.logger.warn(
        `User ${userId} registered but no examfxEmail or screenshot provided`,
      );
    }

    const training = repo.create({
      userId,
      ...dto,
    });

    const saved = await repo.save(training);

    this.logger.log(`Created licensing training record for user ${userId}`);

    return saved;
  }

  /**
   * Update an existing licensing training record
   *
   * @param userId - User ID to update training for
   * @param data - Partial training data to update
   * @param manager - Optional EntityManager for transaction support
   */
  async update(
    userId: string,
    data: Partial<UpdateLicensingTrainingDto>,
    manager?: EntityManager,
  ): Promise<void> {
    const repo = manager
      ? manager.getRepository(LicensingTraining)
      : this.licensingTrainingRepository;

    await repo.update({ userId }, data);
  }
}
