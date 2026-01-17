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
import { ActivationService } from '../activation/activation.service';
import { ActivationActionType } from '../users/enums/activation-action-type.enum';
import { TransactionService } from '../common/services/transaction.service';
import { TransitionEventService } from '../flowbar/services/transition-event.service';
import { TransitionEventType } from '../flowbar/enums/transition-event-type.enum';

@Injectable()
export class ContactsService {
  constructor(
    @InjectRepository(Contact)
    private readonly contactRepository: Repository<Contact>,
    private readonly activationService: ActivationService,
    private readonly transactionService: TransactionService,
    private readonly transitionEventService: TransitionEventService,
  ) {}

  /**
   * Create a new contact and emit lead_created transition event
   *
   * Operations (all atomic within transaction):
   * 1. Create contact record
   * 2. Create lead_created transition event
   *
   * After transaction commits:
   * 3. Push event to SQS queue (fire-and-forget)
   * 4. Trigger activation check (fire-and-forget)
   */
  async create(
    userId: string,
    createContactDto: CreateContactDto,
  ): Promise<Contact> {
    // Wrap contact creation + transition event in a transaction
    const { savedContact, transitionEvent } =
      await this.transactionService.runInTransaction(async (manager) => {
        // Create and save contact
        const contactRepo = manager.getRepository(Contact);
        const contact = contactRepo.create({
          ...createContactDto,
          userId,
          status: createContactDto.status || 'active',
          lastActivityAt: new Date(),
        });
        const savedContact = await contactRepo.save(contact);

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

    return savedContact;
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