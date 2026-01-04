import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { LicensingExam, ExamResult } from '../entities/licensing-exam.entity';
import { LicensingExamAttempt } from '../entities/licensing-exam-attempt.entity';
import { CreateLicensingExamDto } from '../dto/create-licensing-exam.dto';
import { UpdateLicensingExamDto } from '../dto/update-licensing-exam.dto';

@Injectable()
export class LicensingExamService {
  private readonly logger = new Logger(LicensingExamService.name);

  constructor(
    @InjectRepository(LicensingExam)
    private readonly licensingExamRepository: Repository<LicensingExam>,
    @InjectRepository(LicensingExamAttempt)
    private readonly licensingExamAttemptRepository: Repository<LicensingExamAttempt>,
  ) {}

  // ==================== READ OPERATIONS ====================

  /**
   * Find exam record by user ID (returns null if not found)
   */
  async findByUserId(userId: string): Promise<LicensingExam | null> {
    return await this.licensingExamRepository.findOne({
      where: { userId },
    });
  }

  /**
   * Find exam record by user ID or throw NotFoundException
   */
  async findByUserIdOrFail(userId: string): Promise<LicensingExam> {
    const exam = await this.findByUserId(userId);
    if (!exam) {
      throw new NotFoundException('Licensing exam record not found');
    }
    return exam;
  }

  /**
   * Find exam record by user ID with relations or throw NotFoundException
   */
  async findByUserIdWithRelationsOrFail(userId: string): Promise<LicensingExam> {
    const exam = await this.licensingExamRepository.findOne({
      where: { userId },
      relations: ['user'],
    });
    if (!exam) {
      throw new NotFoundException('Licensing exam record not found');
    }
    return exam;
  }

  /**
   * Get all exam attempts for a user (ordered by attempt_number DESC)
   */
  async findAttempts(userId: string): Promise<LicensingExamAttempt[]> {
    return await this.licensingExamAttemptRepository.find({
      where: { user_id: userId },
      order: { attempt_number: 'DESC' },
    });
  }

  /**
   * Check if user has passed the exam
   */
  async hasPassed(userId: string): Promise<boolean> {
    const exam = await this.findByUserId(userId);
    return exam?.result === ExamResult.PASSED;
  }

  // ==================== WRITE OPERATIONS ====================

  /**
   * Get the next attempt number for a user
   * Uses provided manager for transaction support
   *
   * @param userId - User ID
   * @param manager - Optional EntityManager for transaction support
   */
  private async getNextAttemptNumber(
    userId: string,
    manager?: EntityManager,
  ): Promise<number> {
    const repo = manager
      ? manager.getRepository(LicensingExam)
      : this.licensingExamRepository;

    const existing = await repo.findOne({ where: { userId } });
    return existing ? existing.latestAttemptNumber + 1 : 1;
  }

  /**
   * Create or update exam snapshot and create attempt record
   *
   * This is the core method that handles event sourcing:
   * 1. Creates a new attempt record (append-only history)
   * 2. Updates or creates the exam snapshot (current state)
   *
   * @param userId - User ID
   * @param dto - Exam data
   * @param manager - Optional EntityManager for transaction support
   * @throws BadRequestException if isScheduled is true but examDate is missing
   */
  async createOrUpdateWithAttempt(
    userId: string,
    dto: CreateLicensingExamDto,
    manager?: EntityManager,
  ): Promise<LicensingExam> {
    const examRepo = manager
      ? manager.getRepository(LicensingExam)
      : this.licensingExamRepository;
    const attemptRepo = manager
      ? manager.getRepository(LicensingExamAttempt)
      : this.licensingExamAttemptRepository;

    // Validate: if isScheduled is true, examDate is required
    if (dto.isScheduled && !dto.examDate) {
      throw new BadRequestException(
        'Exam date is required when isScheduled is true',
      );
    }

    // Get current exam snapshot (if exists) to determine next attempt number
    const existing = await examRepo.findOne({ where: { userId } });
    const nextAttemptNumber = existing ? existing.latestAttemptNumber + 1 : 1;

    // 1. Insert new attempt record (append-only history)
    const attempt = attemptRepo.create({
      user_id: userId,
      attempt_number: nextAttemptNumber,
      exam_date: dto.examDate,
      result: dto.result,
      result_screenshot: dto.resultDocument,
      submitted_at: new Date(),
    });
    await attemptRepo.save(attempt);

    this.logger.log(
      `Created exam attempt #${nextAttemptNumber} for user ${userId}`,
    );

    // 2. Update or create snapshot record (current state)
    let exam: LicensingExam;
    if (existing) {
      // Update existing snapshot
      existing.isScheduled = dto.isScheduled;
      existing.examDate = dto.examDate ? new Date(dto.examDate) : undefined;
      existing.result = dto.result;
      existing.resultDocument = dto.resultDocument;
      existing.latestAttemptNumber = nextAttemptNumber;
      exam = await examRepo.save(existing);

      this.logger.log(`Updated exam snapshot for user ${userId}`);
    } else {
      // Create new snapshot
      exam = examRepo.create({
        userId,
        isScheduled: dto.isScheduled,
        examDate: dto.examDate ? new Date(dto.examDate) : undefined,
        result: dto.result,
        resultDocument: dto.resultDocument,
        latestAttemptNumber: nextAttemptNumber,
      });
      exam = await examRepo.save(exam);

      this.logger.log(`Created exam snapshot for user ${userId}`);
    }

    return exam;
  }

  /**
   * Update an existing exam snapshot
   *
   * Note: This updates the snapshot only, does NOT create attempt record.
   * Use createOrUpdateWithAttempt for full event sourcing.
   *
   * @param userId - User ID to update exam for
   * @param data - Partial exam data to update
   * @param manager - Optional EntityManager for transaction support
   * @throws BadRequestException if isScheduled is true but examDate is missing
   */
  async update(
    userId: string,
    data: Partial<UpdateLicensingExamDto>,
    manager?: EntityManager,
  ): Promise<void> {
    const repo = manager
      ? manager.getRepository(LicensingExam)
      : this.licensingExamRepository;

    // Validate: if isScheduled is true, examDate is required
    if (data.isScheduled && !data.examDate) {
      throw new BadRequestException(
        'Exam date is required when isScheduled is true',
      );
    }

    // Convert examDate string to Date if provided
    const updateData: Partial<LicensingExam> = {};
    if (data.isScheduled !== undefined) updateData.isScheduled = data.isScheduled;
    if (data.examDate !== undefined) updateData.examDate = new Date(data.examDate);
    if (data.result !== undefined) updateData.result = data.result;
    if (data.resultDocument !== undefined) updateData.resultDocument = data.resultDocument;

    await repo.update({ userId }, updateData);

    this.logger.log(`Updated exam record for user ${userId}`);
  }
}