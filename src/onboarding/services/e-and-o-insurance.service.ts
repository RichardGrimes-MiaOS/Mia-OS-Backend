import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { EAndOInsurance } from '../entities/e-and-o-insurance.entity';
import { CreateEAndOInsuranceDto } from '../dto/create-e-and-o-insurance.dto';

@Injectable()
export class EAndOInsuranceService {
  private readonly logger = new Logger(EAndOInsuranceService.name);

  constructor(
    @InjectRepository(EAndOInsurance)
    private readonly eAndOInsuranceRepository: Repository<EAndOInsurance>,
  ) {}

  // ==================== READ OPERATIONS ====================

  /**
   * Find E&O insurance record by user ID (returns null if not found)
   */
  async findByUserId(userId: string): Promise<EAndOInsurance | null> {
    return await this.eAndOInsuranceRepository.findOne({
      where: { userId },
    });
  }

  /**
   * Find E&O insurance record by user ID or throw NotFoundException
   */
  async findByUserIdOrFail(userId: string): Promise<EAndOInsurance> {
    const insurance = await this.findByUserId(userId);
    if (!insurance) {
      throw new NotFoundException('E&O insurance record not found');
    }
    return insurance;
  }

  /**
   * Find E&O insurance record by ID or throw NotFoundException
   */
  async findByIdOrFail(id: string): Promise<EAndOInsurance> {
    const insurance = await this.eAndOInsuranceRepository.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!insurance) {
      throw new NotFoundException('E&O insurance record not found');
    }
    return insurance;
  }

  /**
   * Find all E&O insurance records for a user (ordered by createdAt DESC)
   */
  async findAllByUserId(userId: string): Promise<EAndOInsurance[]> {
    return await this.eAndOInsuranceRepository.find({
      where: { userId },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Check if user already has E&O insurance record
   */
  async hasInsurance(userId: string): Promise<boolean> {
    const insurance = await this.findByUserId(userId);
    return insurance !== null;
  }

  // ==================== WRITE OPERATIONS ====================

  /**
   * Create a new E&O insurance record
   *
   * @param userId - User ID to create insurance for
   * @param dto - Insurance data
   * @param manager - Optional EntityManager for transaction support
   * @throws ConflictException if insurance record already exists
   */
  async create(
    userId: string,
    dto: CreateEAndOInsuranceDto,
    manager?: EntityManager,
  ): Promise<EAndOInsurance> {
    const repo = manager
      ? manager.getRepository(EAndOInsurance)
      : this.eAndOInsuranceRepository;

    // Check if insurance record already exists
    const existing = await repo.findOne({ where: { userId } });
    if (existing) {
      throw new ConflictException(
        'E&O insurance already exists for this user',
      );
    }

    const insurance = repo.create({
      userId,
      documentPath: dto.documentPath,
      carrierName: dto.carrierName,
      policyNumber: dto.policyNumber,
      expirationDate: new Date(dto.expirationDate),
    });

    const saved = await repo.save(insurance);

    this.logger.log(`Created E&O insurance record for user ${userId}`);

    return saved;
  }

  /**
   * Create E&O insurance without checking for existing record
   * Used in fast-track path where we already validated
   *
   * @param userId - User ID to create insurance for
   * @param dto - Insurance data
   * @param manager - Optional EntityManager for transaction support
   */
  async createWithoutValidation(
    userId: string,
    dto: CreateEAndOInsuranceDto,
    manager?: EntityManager,
  ): Promise<EAndOInsurance> {
    const repo = manager
      ? manager.getRepository(EAndOInsurance)
      : this.eAndOInsuranceRepository;

    const insurance = repo.create({
      userId,
      documentPath: dto.documentPath,
      carrierName: dto.carrierName,
      policyNumber: dto.policyNumber,
      expirationDate: new Date(dto.expirationDate),
    });

    const saved = await repo.save(insurance);

    this.logger.log(
      `Created E&O insurance record (fast-track) for user ${userId}`,
    );

    return saved;
  }
}
