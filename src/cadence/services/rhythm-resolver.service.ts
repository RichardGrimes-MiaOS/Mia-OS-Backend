import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { CadenceLog } from '../entities/cadence-log.entity';
import { RhythmState } from '../enums/rhythm-state.enum';
import { CadenceEventType } from '../enums/event-type.enum';
import { UsersService } from '../../users/users.service';

export interface RhythmStateResponse {
  rhythm_state: RhythmState;
  streak_days: number;
  weeks_on_cadence: number;
  next_threshold: string | null;
  days_remaining_to_next_threshold: number;
  today_status: 'INCOMPLETE' | 'COMPLETE';
  internal_degradation: boolean;
  behavioral_constraints: { suppress_escalation: boolean } | null;
  computed_at: string;
  peer_alignment_eligible: boolean;
  peer_alignment_signals: string[];
  peer_context_count: number;
}

@Injectable()
export class RhythmResolverService {
  constructor(
    @InjectRepository(CadenceLog)
    private cadenceLogRepository: Repository<CadenceLog>,
    private usersService: UsersService,
  ) {}

  /**
   * Pure read-only resolver - computes rhythm state from existing CadenceLogs
   * Does NOT write to database
   * Does NOT trigger side effects
   */
  async resolveRhythmState(userId: string): Promise<RhythmStateResponse> {
    const computedAt = new Date().toISOString();
    const today = new Date().toISOString().split('T')[0];

    // 1. Check if user exists and is eligible (role: agent/affiliate_only, status: active)
    const isEligible = await this.usersService.isEligibleForCadence(userId);

    if (!isEligible) {
      const user = await this.usersService.findOne(userId);
      if (!user) {
        throw new NotFoundException('User not found');
      }
      throw new ForbiddenException(
        'User is not eligible for cadence tracking. Must be agent or affiliate_only with active status.',
      );
    }

    // 2. Get last 21 days of CadenceLog entries
    const twentyOneDaysAgo = new Date();
    twentyOneDaysAgo.setDate(twentyOneDaysAgo.getDate() - 21);
    const cutoffDate = twentyOneDaysAgo.toISOString().split('T')[0];

    const recentLogs = await this.cadenceLogRepository.find({
      where: {
        userId,
        logDate: MoreThanOrEqual(cutoffDate),
      },
      order: { logDate: 'DESC' },
    });

    // 3. Check if any CadenceLog exists at all
    if (recentLogs.length === 0) {
      const allTimeLogs = await this.cadenceLogRepository.count({
        where: { userId },
      });

      if (allTimeLogs === 0) {
        // User has never engaged
        return {
          rhythm_state: RhythmState.NOT_STARTED,
          streak_days: 0,
          weeks_on_cadence: 0,
          next_threshold: RhythmState.STARTING_TO_FLOW,
          days_remaining_to_next_threshold: 1,
          today_status: 'INCOMPLETE',
          internal_degradation: false,
          behavioral_constraints: null,
          computed_at: computedAt,
          peer_alignment_eligible: true,
          peer_alignment_signals: ['FLOW_STATE', 'LIFECYCLE'],
          peer_context_count: 0,
        };
      }
    }

    // 4. Determine today's status
    const todayLog = recentLogs.find((log) => log.logDate === today);
    const todayStatus = this.determineTodayStatus(todayLog);

    // 5. Count consecutive compliant days (ignoring RESET)
    const consecutiveDays = this.countConsecutiveCompliantDays(
      recentLogs,
      today,
    );

    // 6. Calculate weeks on cadence
    const weeksOnCadence = Math.floor(consecutiveDays / 7);

    // 7. Determine rhythm state
    const rhythmState = this.determineRhythmState(consecutiveDays, recentLogs);

    // 8. Calculate next threshold and days remaining
    const { nextThreshold, daysRemaining } =
      this.calculateNextThreshold(rhythmState);

    // 9. Detect internal degradation signal (early warning before state downgrade)
    const internalDegradation = this.detectDegradation(rhythmState, recentLogs);

    // 10. Set behavioral constraints (only for FLOWING_IN_RHYTHM)
    const behavioralConstraints =
      rhythmState === RhythmState.FLOWING_IN_RHYTHM
        ? { suppress_escalation: true }
        : null;

    return {
      rhythm_state: rhythmState,
      streak_days: 0, // Always 0 in Phase 1 MVP
      weeks_on_cadence: weeksOnCadence,
      next_threshold: nextThreshold,
      days_remaining_to_next_threshold: daysRemaining,
      today_status: todayStatus,
      internal_degradation: internalDegradation,
      behavioral_constraints: behavioralConstraints,
      computed_at: computedAt,
      peer_alignment_eligible: true,
      peer_alignment_signals: ['FLOW_STATE', 'LIFECYCLE'],
      peer_context_count: 0,
    };
  }

  /**
   * Determine today's status based on CadenceLog
   */
  private determineTodayStatus(
    todayLog: CadenceLog | undefined,
  ): 'INCOMPLETE' | 'COMPLETE' {
    if (!todayLog) {
      return 'INCOMPLETE';
    }

    // COMPLETE if ACTION_COMPLETED or MILESTONE
    if (
      todayLog.eventType === CadenceEventType.ACTION_COMPLETED ||
      todayLog.eventType === CadenceEventType.MILESTONE
    ) {
      return 'COMPLETE';
    }

    // INCOMPLETE for MISSED or RESET
    return 'INCOMPLETE';
  }

  /**
   * Count consecutive compliant days
   * RESET is ignored (neutral)
   * MISSED breaks the streak
   */
  private countConsecutiveCompliantDays(
    logs: CadenceLog[],
    today: string,
  ): number {
    // Create Map for O(1) date lookups (optimization from O(n²) to O(n))
    const logByDate = new Map(logs.map((l) => [l.logDate, l]));
    let consecutive = 0;

    // Iterate backwards from today
    for (let i = 0; i < logs.length; i++) {
      const expectedDate = this.subtractDays(today, i);
      const log = logByDate.get(expectedDate);

      // Gap detected - no log for this date
      if (!log) {
        break;
      }

      // RESET is neutral - skip and continue counting
      if (log.eventType === CadenceEventType.RESET) {
        continue;
      }

      // Check if compliant
      if (
        log.eventType === CadenceEventType.ACTION_COMPLETED ||
        log.eventType === CadenceEventType.MILESTONE
      ) {
        consecutive++;
      } else {
        // MISSED breaks the streak
        break;
      }
    }

    return consecutive;
  }

  /**
   * Determine rhythm state using density-based pattern analysis with graceful degradation
   *
   * Uses compliance density in rolling windows rather than strict consecutive counting
   * This allows single MISSED days to be absorbed in established rhythms
   *
   * Degradation rules (cascading, never skip states):
   * - FLOWING_IN_RHYTHM: 2 consecutive MISSED OR 3 MISSED in 7 days → ON_CADENCE
   * - ON_CADENCE: 2 MISSED in 4 days → STARTING_TO_FLOW (always, never skip to OFF_RHYTHM)
   * - STARTING_TO_FLOW: Context-aware degradation
   *   - New users (compliant21 < 2): 1 MISSED in 3 days → OFF_RHYTHM (fragile)
   *   - Recovery users (compliant21 >= 2): 2 MISSED in 3 days → OFF_RHYTHM (more forgiving)
   */
  private determineRhythmState(
    consecutiveDays: number,
    recentLogs: CadenceLog[],
  ): RhythmState {
    // No logs at all = NOT_STARTED (handled earlier)

    const today = new Date().toISOString().split('T')[0];

    // Analyze patterns in different windows
    const last30Days = this.getLogsInWindow(recentLogs, today, 30);
    const last21Days = this.getLogsInWindow(recentLogs, today, 21);
    const last7Days = this.getLogsInWindow(recentLogs, today, 7);
    const last4Days = this.getLogsInWindow(recentLogs, today, 4);
    const last3Days = this.getLogsInWindow(recentLogs, today, 3);

    // Count compliant and MISSED in each window
    const compliant30 = this.countCompliantInLogs(last30Days);
    const compliant21 = this.countCompliantInLogs(last21Days);
    const compliant7 = this.countCompliantInLogs(last7Days);
    const compliant4 = this.countCompliantInLogs(last4Days);
    const compliant3 = this.countCompliantInLogs(last3Days);

    const missed7 = this.countMissedInLogs(last7Days);
    const missed4 = this.countMissedInLogs(last4Days);
    const missed3 = this.countMissedInLogs(last3Days);

    // Check for consecutive MISSED from today
    const consecutiveMissedFromToday = this.countConsecutiveMissedFromToday(
      recentLogs,
      today,
    );

    // Determine potential state based on compliance density
    let potentialState: RhythmState;

    // FLOWING_IN_RHYTHM: 21+ compliant days in last 30 days
    // (allows for gaps while maintaining mastery)
    if (compliant30 >= 21) {
      potentialState = RhythmState.FLOWING_IN_RHYTHM;
    }
    // ON_CADENCE: 6+ compliant in last 7 days AND 3+ in last 4 days
    // (strong recent compliance pattern)
    else if (compliant7 >= 6 && compliant4 >= 3) {
      potentialState = RhythmState.ON_CADENCE;
    }
    // STARTING_TO_FLOW: 1-3 compliant in last 4 days
    // (first compliant actions detected, early momentum forming)
    else if (compliant4 >= 1 && compliant4 <= 3) {
      potentialState = RhythmState.STARTING_TO_FLOW;
    }
    // Has some history but doesn't meet thresholds
    else if (recentLogs.length > 0) {
      potentialState = RhythmState.OFF_RHYTHM;
    } else {
      return RhythmState.NOT_STARTED;
    }

    // Apply graceful degradation rules based on potential state
    return this.applyDegradationRules(
      potentialState,
      consecutiveMissedFromToday,
      missed3,
      missed4,
      missed7,
      compliant21,
    );
  }

  /**
   * Count compliant days in a set of logs
   */
  private countCompliantInLogs(logs: CadenceLog[]): number {
    return logs.filter(
      (log) =>
        log.eventType === CadenceEventType.ACTION_COMPLETED ||
        log.eventType === CadenceEventType.MILESTONE,
    ).length;
  }

  /**
   * Count MISSED days in a set of logs
   */
  private countMissedInLogs(logs: CadenceLog[]): number {
    return logs.filter((log) => log.eventType === CadenceEventType.MISSED)
      .length;
  }

  /**
   * Count consecutive MISSED days from today backwards
   */
  private countConsecutiveMissedFromToday(
    logs: CadenceLog[],
    today: string,
  ): number {
    // Create Map for O(1) date lookups (optimization from O(n²) to O(n))
    const logByDate = new Map(logs.map((l) => [l.logDate, l]));
    let consecutive = 0;

    // Iterate from today backwards
    for (let i = 0; i < logs.length; i++) {
      const expectedDate = this.subtractDays(today, i);
      const log = logByDate.get(expectedDate);

      if (!log) break; // No log for this date

      if (log.eventType === CadenceEventType.MISSED) {
        consecutive++;
      } else if (log.eventType === CadenceEventType.RESET) {
        // RESET is neutral, continue checking
        continue;
      } else {
        // Hit a compliant day, stop counting
        break;
      }
    }

    return consecutive;
  }

  /**
   * Apply graceful degradation rules based on potential state and recent MISSED patterns
   */
  private applyDegradationRules(
    potentialState: RhythmState,
    consecutiveMissed: number,
    missed3: number,
    missed4: number,
    missed7: number,
    compliant21: number,
  ): RhythmState {
    switch (potentialState) {
      case RhythmState.FLOWING_IN_RHYTHM:
        // Require 2 consecutive MISSED OR 3 MISSED in 7 days to degrade
        if (consecutiveMissed >= 2 || missed7 >= 3) {
          return RhythmState.ON_CADENCE; // Graceful decay
        }
        return RhythmState.FLOWING_IN_RHYTHM;

      case RhythmState.ON_CADENCE:
        // Require 2 MISSED in 4 days to degrade
        // Always degrade to STARTING_TO_FLOW (never skip to OFF_RHYTHM)
        if (missed4 >= 2) {
          return RhythmState.STARTING_TO_FLOW;
        }
        return RhythmState.ON_CADENCE;

      case RhythmState.STARTING_TO_FLOW:
        // Distinguish between new users and recovery users
        // Recovery detection: compliant21 >= 2 indicates historical momentum
        const isRecovery = compliant21 >= 2;

        if (isRecovery) {
          // Recovery users (coming from ON_CADENCE): More forgiving
          // 2 MISSED in 3 days → OFF_RHYTHM (allows 1 warning MISSED)
          if (missed3 >= 2) {
            return RhythmState.OFF_RHYTHM;
          }
        } else {
          // New users: Fragile momentum
          // 1 MISSED in 3 days → OFF_RHYTHM (early momentum is brittle)
          if (missed3 >= 1) {
            return RhythmState.OFF_RHYTHM;
          }
        }
        return RhythmState.STARTING_TO_FLOW;

      case RhythmState.OFF_RHYTHM:
      case RhythmState.NOT_STARTED:
      default:
        return potentialState;
    }
  }

  /**
   * Detect internal degradation signal - early warning before state downgrade
   *
   * Purpose: Let Mia soften tone before OFF_RHYTHM, distinguish "wobble" from "fall"
   *
   * Rules:
   * - NOT_STARTED: no degradation possible (no history)
   * - OFF_RHYTHM: no degradation signal (already fallen, not "before falling")
   * - STARTING_TO_FLOW: no degradation signal (downgrade threshold leaves no yellow light window)
   * - ON_CADENCE: degradation = 1 MISSED in last 4 days OR explicit MISSED today
   * - FLOWING_IN_RHYTHM: degradation = 1 consecutive MISSED OR 1-2 MISSED in last 7 days
   */
  private detectDegradation(
    rhythmState: RhythmState,
    recentLogs: CadenceLog[],
  ): boolean {
    // NOT_STARTED: No degradation possible (no history)
    if (rhythmState === RhythmState.NOT_STARTED) {
      return false;
    }

    // OFF_RHYTHM: No degradation signal (already fallen, not "before falling")
    // Mia should check rhythm_state === OFF_RHYTHM directly for recovery tone
    if (rhythmState === RhythmState.OFF_RHYTHM) {
      return false;
    }

    const today = new Date().toISOString().split('T')[0];

    // Get today's log to check for explicit MISSED
    const todayLog = recentLogs.find((log) => log.logDate === today);
    const hasMissedToday = todayLog?.eventType === CadenceEventType.MISSED;

    // Calculate windows (reuse existing helper methods)
    const last7Days = this.getLogsInWindow(recentLogs, today, 7);
    const last4Days = this.getLogsInWindow(recentLogs, today, 4);

    const missed7 = this.countMissedInLogs(last7Days);
    const missed4 = this.countMissedInLogs(last4Days);
    const consecutiveMissed = this.countConsecutiveMissedFromToday(
      recentLogs,
      today,
    );

    switch (rhythmState) {
      case RhythmState.STARTING_TO_FLOW:
        // No degradation signal - downgrade threshold (1 MISSED in 3 days)
        // leaves no "yellow light" window. Either building momentum or not.
        return false;

      case RhythmState.ON_CADENCE:
        // Yellow light: 1 MISSED in last 4 days OR explicit MISSED today
        // Note: Only check explicit MISSED, not time-of-day absence of log
        return missed4 === 1 || hasMissedToday;

      case RhythmState.FLOWING_IN_RHYTHM:
        // Yellow light: 1 consecutive MISSED OR 1-2 MISSED in last 7 days
        // (before hitting downgrade threshold of 2 consecutive or 3 in 7 days)
        return consecutiveMissed === 1 || (missed7 >= 1 && missed7 <= 2);

      default:
        return false;
    }
  }

  /**
   * Get logs within a rolling window (last N days from today)
   */
  private getLogsInWindow(
    logs: CadenceLog[],
    today: string,
    days: number,
  ): CadenceLog[] {
    const windowStart = this.subtractDays(today, days - 1);
    return logs.filter(
      (log) => log.logDate >= windowStart && log.logDate <= today,
    );
  }

  /**
   * Calculate next threshold and days remaining
   * Uses density-based estimates aligned with pattern analysis
   */
  private calculateNextThreshold(rhythmState: RhythmState): {
    nextThreshold: string | null;
    daysRemaining: number;
  } {
    switch (rhythmState) {
      case RhythmState.NOT_STARTED:
        return {
          nextThreshold: RhythmState.STARTING_TO_FLOW,
          daysRemaining: 1, // First compliant action triggers STARTING_TO_FLOW
        };

      case RhythmState.OFF_RHYTHM:
        return {
          nextThreshold: RhythmState.STARTING_TO_FLOW,
          daysRemaining: 1, // First compliant action triggers STARTING_TO_FLOW
        };

      case RhythmState.STARTING_TO_FLOW:
        return {
          nextThreshold: RhythmState.ON_CADENCE,
          daysRemaining: 6, // Need 6 compliant in 7 days (estimated)
        };

      case RhythmState.ON_CADENCE:
        return {
          nextThreshold: RhythmState.FLOWING_IN_RHYTHM,
          daysRemaining: 21, // Need 21 compliant in 30 days (estimated)
        };

      case RhythmState.FLOWING_IN_RHYTHM:
        return {
          nextThreshold: null,
          daysRemaining: 0,
        };

      default:
        return {
          nextThreshold: null,
          daysRemaining: 0,
        };
    }
  }

  /**
   * Subtract days from a date string (YYYY-MM-DD)
   */
  private subtractDays(dateStr: string, days: number): string {
    const date = new Date(dateStr);
    date.setDate(date.getDate() - days);
    return date.toISOString().split('T')[0];
  }
}
