/**
 * Resolves the active sample set from an analysis-mode selection.
 */

import type {
  AnalysisSelection,
  CombinedDataset,
  GapSample,
} from '@/types/gap';

/** Returns the samples that the current analysis selection targets. */
export function selectSamples(
  dataset: CombinedDataset,
  selection: AnalysisSelection,
): GapSample[] {
  switch (selection.mode) {
    case 'combined':
      return dataset.samples;

    case 'day-wise':
      // Day-wise still operates on the full set; per-day grouping happens
      // downstream via dataset.byDay. Treat as combined for overview totals.
      return dataset.samples;

    case 'single-day': {
      const day = selection.singleDay;
      if (!day) return [];
      return dataset.byDay[day] ?? [];
    }

    case 'custom-range': {
      const { start, end } = selection.customRange;
      if (!start && !end) return dataset.samples;
      return dataset.samples.filter((s) => {
        if (s.dayKey === 'unknown') return false;
        if (start && s.dayKey < start) return false;
        if (end && s.dayKey > end) return false;
        return true;
      });
    }

    default:
      return dataset.samples;
  }
}

/** Short human label describing the active selection. */
export function describeSelection(selection: AnalysisSelection): string {
  switch (selection.mode) {
    case 'combined':
      return 'Combined Analysis';
    case 'day-wise':
      return 'Day Wise Analysis';
    case 'single-day':
      return selection.singleDay
        ? `Single Day · ${selection.singleDay}`
        : 'Single Day';
    case 'custom-range': {
      const { start, end } = selection.customRange;
      if (start && end) return `Custom Range · ${start} → ${end}`;
      if (start) return `Custom Range · from ${start}`;
      if (end) return `Custom Range · until ${end}`;
      return 'Custom Range';
    }
    default:
      return 'Analysis';
  }
}
