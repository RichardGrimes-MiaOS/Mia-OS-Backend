/**
 * Priority bands for tie-breaking within the same action category
 *
 * Order of precedence (highest to lowest):
 * 1. HIGH
 * 2. MED
 * 3. LOW
 */
export enum PriorityBand {
  HIGH = 'HIGH',
  MED = 'MED',
  LOW = 'LOW',
}