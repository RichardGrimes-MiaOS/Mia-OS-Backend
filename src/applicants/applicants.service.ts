import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Applicant, ApplicantStatus } from './entities/applicant.entity';
import { CreateApplicantDto } from './dto/create-applicant.dto';
import { UpdateApplicantDto } from './dto/update-applicant.dto';
import { UpdateApplicantStatusDto } from './dto/update-applicant-status.dto';

@Injectable()
export class ApplicantsService {
  constructor(
    @InjectRepository(Applicant)
    private readonly applicantRepository: Repository<Applicant>,
  ) {}

  async create(createApplicantDto: CreateApplicantDto): Promise<Applicant> {
    try {
      // Check if applicant with email already exists
      const existingApplicant = await this.applicantRepository.findOne({
        where: { email: createApplicantDto.email },
      });

      if (existingApplicant) {
        throw new ConflictException(
          `Applicant with email ${createApplicantDto.email} already exists`,
        );
      }

      const applicant = this.applicantRepository.create({
        ...createApplicantDto,
        status: ApplicantStatus.PENDING,
      });

      return await this.applicantRepository.save(applicant);
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new BadRequestException('Failed to create applicant');
    }
  }

  async findAll(): Promise<Applicant[]> {
    return await this.applicantRepository.find({
      relations: ['updatedBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Applicant> {
    const applicant = await this.applicantRepository.findOne({
      where: { id },
      relations: ['updatedBy'],
    });

    if (!applicant) {
      throw new NotFoundException(`Applicant with ID ${id} not found`);
    }

    return applicant;
  }

  async findByStatus(status: ApplicantStatus): Promise<Applicant[]> {
    return await this.applicantRepository.find({
      where: { status },
      relations: ['updatedBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async update(
    id: string,
    updateApplicantDto: UpdateApplicantDto,
    updatedById: string,
  ): Promise<Applicant> {
    const applicant = await this.findOne(id);

    // Check if email is being updated and if it already exists
    if (
      updateApplicantDto.email &&
      updateApplicantDto.email !== applicant.email
    ) {
      const existingApplicant = await this.applicantRepository.findOne({
        where: { email: updateApplicantDto.email },
      });

      if (existingApplicant) {
        throw new ConflictException(
          `Applicant with email ${updateApplicantDto.email} already exists`,
        );
      }
    }

    Object.assign(applicant, updateApplicantDto);
    applicant.updatedById = updatedById;

    try {
      return await this.applicantRepository.save(applicant);
    } catch (error) {
      throw new BadRequestException('Failed to update applicant');
    }
  }

  async updateStatus(
    id: string,
    updateStatusDto: UpdateApplicantStatusDto,
    updatedById: string,
  ): Promise<Applicant> {
    const applicant = await this.findOne(id);

    applicant.status = updateStatusDto.status;
    applicant.updatedById = updatedById;

    try {
      return await this.applicantRepository.save(applicant);
    } catch (error) {
      throw new BadRequestException('Failed to update applicant status');
    }
  }

  async remove(id: string): Promise<void> {
    const applicant = await this.findOne(id);

    try {
      await this.applicantRepository.remove(applicant);
    } catch (error) {
      throw new BadRequestException('Failed to delete applicant');
    }
  }

  async getStatistics(): Promise<{
    total: number;
    pending: number;
    accepted: number;
    rejected: number;
  }> {
    const [total, pending, accepted, rejected] = await Promise.all([
      this.applicantRepository.count(),
      this.applicantRepository.count({
        where: { status: ApplicantStatus.PENDING },
      }),
      this.applicantRepository.count({
        where: { status: ApplicantStatus.ACCEPTED },
      }),
      this.applicantRepository.count({
        where: { status: ApplicantStatus.REJECTED },
      }),
    ]);

    return {
      total,
      pending,
      accepted,
      rejected,
    };
  }
}
