import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contact } from './entities/contact.entity';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { FilterContactDto } from './dto/filter-contact.dto';
import { UserRole } from '../users/entities/user.entity';
import { PipelineStage } from './enums/pipeline-stage.enum';

@Injectable()
export class ContactsService {
  constructor(
    @InjectRepository(Contact)
    private readonly contactRepository: Repository<Contact>,
  ) {}

  async create(
    userId: string,
    createContactDto: CreateContactDto,
  ): Promise<Contact> {
    const contact = this.contactRepository.create({
      ...createContactDto,
      userId,
      status: createContactDto.status || 'active',
      lastActivityAt: new Date(),
    });

    return this.contactRepository.save(contact);
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

    // Apply filters
    if (filters.pipelineStage) {
      queryBuilder.andWhere('contact.pipelineStage = :pipelineStage', {
        pipelineStage: filters.pipelineStage,
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

    queryBuilder.orderBy('contact.createdAt', 'DESC');

    return queryBuilder.getMany();
  }

  async findOne(
    contactId: string,
    userId: string,
    userRole: UserRole,
  ): Promise<Contact> {
    const contact = await this.contactRepository.findOne({
      where: { id: contactId },
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

    return this.contactRepository.save(contact);
  }

  async remove(
    contactId: string,
    userId: string,
    userRole: UserRole,
  ): Promise<void> {
    const contact = await this.findOne(contactId, userId, userRole);
    await this.contactRepository.remove(contact);
  }

  async updatePipelineStage(
    contactId: string,
    userId: string,
    userRole: UserRole,
    newStage: PipelineStage,
  ): Promise<Contact> {
    const contact = await this.findOne(contactId, userId, userRole);

    contact.pipelineStage = newStage;
    contact.lastActivityAt = new Date();

    return this.contactRepository.save(contact);
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