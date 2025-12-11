import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { PipelineStage } from '../enums/pipeline-stage.enum';

@Entity('contacts')
@Index(['userId'])
@Index(['pipelineStage'])
@Index(['userId', 'pipelineStage'])
export class Contact {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, (user) => user.contacts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone?: string;

  @Column({ type: 'varchar', length: 50, default: 'active' })
  status: string;

  @Column({
    type: 'enum',
    enum: PipelineStage,
    default: PipelineStage.NEW,
  })
  pipelineStage: PipelineStage;

  @Column({ type: 'timestamp', nullable: true })
  lastActivityAt?: Date;

  @OneToMany('Task', 'contact')
  tasks: any[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}