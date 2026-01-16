/**
 * TransitionEventType Enum
 *
 * Represents the lifecycle events that move a contact through the Flow Bar.
 * Each event type corresponds to a specific milestone in the sales pipeline.
 *
 * These events are append-only and used to determine Flow Bar state:
 * - Frontend fetches transition_events for a contact_id
 * - If an event exists for a step, that step is "lit"
 * - No event means no glow
 */
export enum TransitionEventType {
  /** Contact/lead created - identity or economic commitment */
  LEAD_CREATED = 'lead_created',

  /** First real message committed (outreach sent) */
  FIRST_OUTREACH_SENT = 'first_outreach_sent',

  /** Lead replied on any channel */
  FIRST_INBOUND_RECEIVED = 'first_inbound_received',

  /** Form submitted - qualification milestone */
  QUALIFIED = 'qualified',

  /** Calendar booked (stub allowed for v1) */
  APPOINTMENT_SET = 'appointment_set',

  /** Deal accepted / sold */
  DEAL_CLOSED = 'deal_closed',
}
