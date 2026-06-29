/**
 * Historical Strategy Finder — Parameter Generation Engine (Phase 11A).
 *
 * FOUNDATION MODE: this module ONLY generates and validates research parameter
 * combinations. It NEVER executes the Research Engine, never calculates
 * recovery/score/ranking, and never recommends a strategy. Later phases will
 * consume the validated (READY) combinations.
 *
 * Pure and side-effect free, so the view can memoize a single generation pass
 * and reuse it until the inputs change.
 */

export type StrategyStatus = 'PENDING' | 'READY' | 'INVALID' | 'DUPLICATE';

export interface NumericRange {
  start: number;
  end: number;
  step: number;
}

export interface StrategyDateRange {
  from: string; // '' when unset
  to: string; // '' when unset
}

export interface StrategyFinderInput {
  entry: NumericRange;
  recovery: NumericRange;
  stopLoss: NumericRange;
  minTrades: number;
  maxHoldingMinutes: number | null;
  sameDayOnly: boolean;
  dateRange: StrategyDateRange;
  sessions: string[];
}

/** One fully-specified, validated research parameter set. */
export interface StrategyCombination {
  id: string;
  entryGap: number;
  recoveryGap: number;
  stopLoss: number;
  holdingMinutes: number | null;
  sameDayOnly: boolean;
  dateRange: StrategyDateRange;
  sessions: string[];
  status: StrategyStatus;
  /** Human-readable validation outcome (e.g. "OK", "Recovery Gap ≥ Entry Gap"). */
  validationResult: string;
}

export interface StrategyFinderSummary {
  generated: number;
  valid: number;
  rejected: number;
  duplicates: number;
  invalid: number;
}

export interface StrategyFinderResult {
  combinations: StrategyCombination[];
  summary: StrategyFinderSummary;
  /** True when the cartesian product exceeded the generation cap. */
  truncated: boolean;
  input: StrategyFinderInput;
}

export const DEFAULT_STRATEGY_FINDER_INPUT: StrategyFinderInput = {
  entry: { start: 16.0, end: 18.0, step: 0.5 },
  recovery: { start: 13.0, end: 15.0, step: 0.5 },
  stopLoss: { start: 18.0, end: 22.0, step: 0.5 },
  minTrades: 10,
  maxHoldingMinutes: null,
  sameDayOnly: true,
  dateRange: { from: '', to: '' },
  sessions: [],
};

/** Hard ceiling on the cartesian product, to keep generation responsive. */
export const MAX_COMBINATIONS = 20000;
/** Per-dimension ladder cap. */
const MAX_LEVELS = 400;
const EPS = 1e-9;

function round(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

/** Decimal places implied by the step size, for clean ladder labels. */
function decimalsFor(step: number): number {
  const s = String(step);
  const dot = s.indexOf('.');
  return dot === -1 ? 0 : Math.min(6, s.length - dot - 1);
}

/** Builds an inclusive numeric ladder from a range. Returns [] when invalid. */
export function buildLadder(range: NumericRange): number[] {
  const { start, end, step } = range;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return [];
  if (start > end + EPS) return [];
  if (!Number.isFinite(step) || step <= 0) return [round(start, 6)];

  const decimals = decimalsFor(step);
  const out: number[] = [];
  let v = start;
  let guard = 0;
  while (v <= end + EPS && guard < MAX_LEVELS) {
    out.push(round(v, decimals));
    v = round(v + step, decimals);
    guard += 1;
  }
  return out;
}

/** Validates the three gap parameters. Returns the rejection reason, or null. */
function validateTriplet(
  entryGap: number,
  recoveryGap: number,
  stopLoss: number,
): string | null {
  if (
    !Number.isFinite(entryGap) ||
    !Number.isFinite(recoveryGap) ||
    !Number.isFinite(stopLoss)
  ) {
    return 'Invalid numeric value';
  }
  if (recoveryGap >= entryGap) return 'Recovery Gap ≥ Entry Gap';
  if (stopLoss <= entryGap) return 'Stop Loss ≤ Entry Gap';
  if (recoveryGap >= stopLoss) return 'Recovery Gap ≥ Stop Loss';
  return null;
}

function key(entryGap: number, recoveryGap: number, stopLoss: number): string {
  return `${entryGap}|${recoveryGap}|${stopLoss}`;
}

/**
 * Generates every valid parameter combination from the input ranges.
 * Each combination starts PENDING and is then resolved to READY / INVALID /
 * DUPLICATE. The Research Engine is never invoked.
 */
export function generateStrategies(input: StrategyFinderInput): StrategyFinderResult {
  const entryLevels = buildLadder(input.entry);
  const recoveryLevels = buildLadder(input.recovery);
  const slLevels = buildLadder(input.stopLoss);

  const combinations: StrategyCombination[] = [];
  const seen = new Set<string>();
  let valid = 0;
  let invalid = 0;
  let duplicates = 0;
  let truncated = false;
  let counter = 0;

  outer: for (const entryGap of entryLevels) {
    for (const recoveryGap of recoveryLevels) {
      for (const stopLoss of slLevels) {
        if (combinations.length >= MAX_COMBINATIONS) {
          truncated = true;
          break outer;
        }

        counter += 1;
        const id = `SF-${String(counter).padStart(5, '0')}`;

        // Every combination starts PENDING, then validation resolves it.
        let status: StrategyStatus = 'PENDING';
        let validationResult = 'OK';

        const reason = validateTriplet(entryGap, recoveryGap, stopLoss);
        if (reason) {
          status = 'INVALID';
          validationResult = reason;
          invalid += 1;
        } else {
          const k = key(entryGap, recoveryGap, stopLoss);
          if (seen.has(k)) {
            status = 'DUPLICATE';
            validationResult = 'Duplicate combination';
            duplicates += 1;
          } else {
            seen.add(k);
            status = 'READY';
            validationResult = 'OK';
            valid += 1;
          }
        }

        combinations.push({
          id,
          entryGap,
          recoveryGap,
          stopLoss,
          holdingMinutes: input.maxHoldingMinutes,
          sameDayOnly: input.sameDayOnly,
          dateRange: input.dateRange,
          sessions: input.sessions,
          status,
          validationResult,
        });
      }
    }
  }

  const generated = combinations.length;
  return {
    combinations,
    summary: {
      generated,
      valid,
      rejected: invalid + duplicates,
      duplicates,
      invalid,
    },
    truncated,
    input,
  };
}
