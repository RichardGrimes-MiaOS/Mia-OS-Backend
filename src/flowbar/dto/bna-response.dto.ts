import { ApiProperty } from '@nestjs/swagger';
import { ActionType } from '../enums/action-type.enum';
import { ActionCategory } from '../enums/action-category.enum';
import { PriorityBand } from '../enums/priority-band.enum';
import { GuidanceReasonCode } from '../enums/guidance-reason-code.enum';
import { ActionKey } from '../../daily-plan/enums/action-key.enum';

/**
 * Context object for actionable recommendations
 */
export class ActionableContextDto {
  @ApiProperty({ enum: ActionCategory })
  category: ActionCategory;

  @ApiProperty({ enum: PriorityBand })
  priority_band: PriorityBand;

  @ApiProperty({ type: Number, minimum: 0, maximum: 5 })
  unblock_score: number;

  @ApiProperty({ type: Boolean })
  cadence_aligned: boolean;

  @ApiProperty({ type: String })
  explanation: string;
}

/**
 * Actionable recommendation response
 */
export class ActionableRecommendationDto {
  @ApiProperty({ enum: ActionType })
  action_type: Exclude<ActionType, ActionType.SUPPORTIVE_GUIDANCE>;

  @ApiProperty({ type: String, nullable: true })
  target_id: string | null;

  @ApiProperty({ enum: ['BLOCKER', 'REQUIRED', 'CADENCE_ALIGNED', 'OPS'] })
  reason_code: 'BLOCKER' | 'REQUIRED' | 'CADENCE_ALIGNED' | 'OPS';

  @ApiProperty({ type: String })
  cta: string;

  @ApiProperty({ type: ActionableContextDto })
  context: ActionableContextDto;
}

/**
 * Context object for supportive guidance
 */
export class SupportiveContextDto {
  @ApiProperty({ type: String })
  user_state: string;

  @ApiProperty({ enum: ActionKey, nullable: true })
  last_action_completed: ActionKey | null;

  @ApiProperty({ type: String, nullable: true })
  blocking_reason: string | null;
}

/**
 * Supportive guidance response
 */
export class SupportiveGuidanceDto {
  @ApiProperty({ enum: [ActionType.SUPPORTIVE_GUIDANCE] })
  action_type: ActionType.SUPPORTIVE_GUIDANCE;

  @ApiProperty({ enum: GuidanceReasonCode })
  reason_code: GuidanceReasonCode;

  @ApiProperty({ type: String })
  message: string;

  @ApiProperty({ type: SupportiveContextDto })
  context: SupportiveContextDto;
}

/**
 * BNA Response DTO
 *
 * Union type representing either an actionable recommendation or supportive guidance.
 * Used for API responses from GET /flowbar/guide
 */
export type BNAResponseDto = ActionableRecommendationDto | SupportiveGuidanceDto;