import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { TransitionEventType } from '../enums/transition-event-type.enum';
import { Contact } from '../../contacts/entities/contact.entity';
import { User } from '../../users/entities/user.entity';

/**
 * TransitionEvent Entity
 *
 * Tracks lifecycle events that move a contact through the Flow Bar.
 * Each event represents a milestone in the sales pipeline.
 *
 * Key characteristics:
 * - Append-only: Events are immutable once created
 * - One event per type per contact: UNIQUE(contact_id, event_type)
 * - Source tracking: Identifies origin (system, mia, agent, webhook)
 * - Channel tracking: Identifies communication channel (sms, email, voice, web)
 *
 * Flow Bar computation:
 * - Frontend fetches transition_events for contact_id
 * - If event exists for a step → step is lit
 * - No event → no glow
 */
@Entity('transition_events')
@Unique(['contactId', 'eventType'])
@Index(['contactId'])
@Index(['userId'])
@Index(['eventType'])
@Index(['occurredAt'])
export class TransitionEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ==================== OWNERSHIP ====================

  @Column({ type: 'uuid' })
  contactId: string;

  @ManyToOne(() => Contact, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contactId' })
  contact: Contact;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  // ==================== EVENT IDENTITY ====================

  @Column({
    type: 'enum',
    enum: TransitionEventType,
    comment: 'Type of transition event in the Flow Bar lifecycle',
  })
  eventType: TransitionEventType;

  @Column({
    type: 'uuid',
    nullable: true,
    comment: 'Future-safe: links to decision record when AI-driven decisions are implemented',
  })
  decisionId: string | null;

  // ==================== ORDERING & TIME ====================

  @Column({
    type: 'timestamptz',
    default: () => 'now()',
    comment: 'When the event occurred',
  })
  occurredAt: Date;

  // ==================== METADATA ====================

  @Column({
    type: 'text',
    nullable: true,
    comment: 'Event source: system | mia | agent | webhook',
  })
  source: string | null;

  @Column({
    type: 'text',
    nullable: true,
    comment: 'Communication channel: sms | email | voice | web',
  })
  channel: string | null;

  @Column({
    type: 'jsonb',
    nullable: true,
    comment: 'Event-specific data payload',
  })
  payload: Record<string, any> | null;
}