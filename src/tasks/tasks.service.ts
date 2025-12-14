import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from './entities/task.entity';
import { Contact } from '../contacts/entities/contact.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { FilterTaskDto } from './dto/filter-task.dto';
import { UserRole } from '../users/entities/user.entity';
import { TaskStatus } from './enums/task-status.enum';
import { ActivationService } from '../activation/activation.service';
import { ActivationActionType } from '../users/enums/activation-action-type.enum';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    @InjectRepository(Contact)
    private readonly contactRepository: Repository<Contact>,
    private readonly activationService: ActivationService,
  ) {}

  async create(userId: string, createTaskDto: CreateTaskDto): Promise<Task> {
    // Validate contact ownership if contactId is provided
    if (createTaskDto.contactId) {
      await this.validateContactOwnership(createTaskDto.contactId, userId);
    }

    const task = this.taskRepository.create({
      ...createTaskDto,
      userId,
    });

    const savedTask = await this.taskRepository.save(task);

    // Reload task with contact relation
    const taskWithContact = await this.taskRepository.findOne({
      where: { id: savedTask.id },
      relations: ['contact'],
    });

    if (!taskWithContact) {
      throw new NotFoundException(`Task with ID ${savedTask.id} not found`);
    }

    // Add isOverdue flag
    return {
      ...taskWithContact,
      isOverdue:
        taskWithContact.status === TaskStatus.OPEN &&
        new Date(taskWithContact.dueDate) < new Date(),
    } as Task;
  }

  async findAll(
    userId: string,
    userRole: UserRole,
    filters: FilterTaskDto,
  ): Promise<Task[]> {
    const queryBuilder = this.taskRepository.createQueryBuilder('task');

    // Load contact relation
    queryBuilder.leftJoinAndSelect('task.contact', 'contact');

    // Permission-based filtering
    if (userRole === UserRole.AGENT) {
      queryBuilder.where('task.userId = :userId', { userId });
    }
    // Admin and Super Admin can see all tasks (no additional filter)

    // Apply filters
    if (filters.status) {
      queryBuilder.andWhere('task.status = :status', {
        status: filters.status,
      });
    }

    if (filters.contactId) {
      queryBuilder.andWhere('task.contactId = :contactId', {
        contactId: filters.contactId,
      });
    }

    if (filters.search) {
      queryBuilder.andWhere(
        '(task.title ILIKE :search OR task.description ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    // Filter overdue tasks
    if (filters.overdue === 'true') {
      queryBuilder.andWhere('task.dueDate < :now', { now: new Date() });
      queryBuilder.andWhere('task.status = :open', {
        open: TaskStatus.OPEN,
      });
    }

    queryBuilder.orderBy('task.dueDate', 'ASC');

    const tasks = await queryBuilder.getMany();

    // Add isOverdue flag to each task
    return tasks.map((task) => ({
      ...task,
      isOverdue:
        task.status === TaskStatus.OPEN &&
        new Date(task.dueDate) < new Date(),
    }));
  }

  async findOne(
    taskId: string,
    userId: string,
    userRole: UserRole,
  ): Promise<Task> {
    const task = await this.taskRepository.findOne({
      where: { id: taskId },
      relations: ['contact'],
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${taskId} not found`);
    }

    if (!this.canAccessTask(task, userId, userRole)) {
      throw new ForbiddenException(
        'You do not have permission to access this task',
      );
    }

    // Add isOverdue flag
    return {
      ...task,
      isOverdue:
        task.status === TaskStatus.OPEN &&
        new Date(task.dueDate) < new Date(),
    };
  }

  async update(
    taskId: string,
    userId: string,
    userRole: UserRole,
    updateTaskDto: UpdateTaskDto,
  ): Promise<Task> {
    const task = await this.findOne(taskId, userId, userRole);

    // Validate contact ownership if contactId is being changed
    if (
      updateTaskDto.contactId !== undefined &&
      updateTaskDto.contactId !== task.contactId
    ) {
      if (updateTaskDto.contactId) {
        await this.validateContactOwnership(updateTaskDto.contactId, userId);
      }
    }

    // Check if task is being completed
    const wasNotCompleted = task.status !== TaskStatus.COMPLETED;
    const isNowCompleted = updateTaskDto.status === TaskStatus.COMPLETED;

    Object.assign(task, updateTaskDto);

    await this.taskRepository.save(task);

    // Trigger activation when agent completes their first task
    if (wasNotCompleted && isNowCompleted) {
      await this.activationService.triggerActivation(
        task.userId,
        ActivationActionType.TASK_COMPLETED,
      );
    }

    // Reload task with contact relation
    const updatedTask = await this.taskRepository.findOne({
      where: { id: taskId },
      relations: ['contact'],
    });

    if (!updatedTask) {
      throw new NotFoundException(`Task with ID ${taskId} not found`);
    }

    // Add isOverdue flag
    return {
      ...updatedTask,
      isOverdue:
        updatedTask.status === TaskStatus.OPEN &&
        new Date(updatedTask.dueDate) < new Date(),
    } as Task;
  }

  async remove(
    taskId: string,
    userId: string,
    userRole: UserRole,
  ): Promise<void> {
    const task = await this.findOne(taskId, userId, userRole);
    await this.taskRepository.remove(task);
  }

  private canAccessTask(
    task: Task,
    userId: string,
    userRole: UserRole,
  ): boolean {
    if (userRole === UserRole.ADMIN || userRole === UserRole.SUPER_ADMIN) {
      return true;
    }

    if (userRole === UserRole.AGENT) {
      return task.userId === userId;
    }

    return false;
  }

  private async validateContactOwnership(
    contactId: string,
    userId: string,
  ): Promise<void> {
    const contact = await this.contactRepository.findOne({
      where: { id: contactId },
    });

    if (!contact) {
      throw new NotFoundException(`Contact with ID ${contactId} not found`);
    }

    if (contact.userId !== userId) {
      throw new ForbiddenException(
        'Cannot link task to another agent\'s contact',
      );
    }
  }
}