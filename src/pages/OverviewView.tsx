/**
 * Overview Dashboard 2.0 — institutional quantitative research terminal.
 *
 * Read-only market intelligence over the uploaded CSV history. It consumes the
 * Research Engine (v1.0, computeScenario) for position/recovery numbers but does
 * NOT simulate trades or reimplement scenario logic — that stays in Research
 * Lab. Everything respects the global filters (files, date range, session,
 * sync) via `filteredSamples`.
 */

import { useMemo } from 'react';
import { useData } from '@/context/DataContext';
import { AnalysisModeSelector } from '@/components/common/AnalysisModeSelector';
import { FilterBar } from '@/components/filters/FilterBar';
import { WarningsPanel } from '@/components/overview/WarningsPanel';
import { SampleTable } from '@/components/overview/SampleTable';
import {
  buildDataQuality,
  buildDatasetInfo,
  buildFrequencyTable,
  buildGapDistribution,
  buildMarketSummary,
  buildReferenceScenario,
  computeGapStats,
} from '@/utils/overviewStats';
import {
  computeScenario,
  RESEARCH_ENGINE_VERSION,
} from '@/utils/scenario';
import { DatasetInfoSection } from '@/components/overview2/DatasetInfoSection';
import { GapStatsSection } from '@/components/overview2/GapStatsSection';
import { DataQualitySection } from '@/components/overview2/DataQualitySection';
import { MarketSummarySection } from '@/components/overview2/MarketSummarySection';
import { GapDistributionSection } from '@/components/overview2/GapDistributionSection';
import { GapFrequencySection } from '@/components/overview2/GapFrequencySection';
import { OverviewSessionSection } from '@/components/overview2/OverviewSessionSection';
import { OverviewDailySection } from '@/components/overview2/OverviewDailySection';
import { RareGapSection } from '@/components/overview2/RareGapSection';

export function OverviewView() {
  const { filteredSamples, validation } = useData();

  // Reference scenario derived from the data — used only to CONSUME the Research
  // Engine for descriptive position/recovery figures.
  const reference = useMemo(
    () => buildReferenceScenario(filteredSamples),
    [filteredSamples],
  );
  const referenceResult = useMemo(
    () => computeScenario(filteredSamples, reference),
    [filteredSamples, reference],
  );

  const gapStats = useMemo(() => computeGapStats(filteredSamples), [filteredSamples]);
  const distribution = useMemo(
    () => buildGapDistribution(filteredSamples),
    [filteredSamples],
  );
  const frequency = useMemo(
    () => buildFrequencyTable(filteredSamples),
    [filteredSamples],
  );
  const datasetInfo = useMemo(
    () => (validation ? buildDatasetInfo(filteredSamples, validation) : null),
    [filteredSamples, validation],
  );
  const dataQuality = useMemo(
    () => (validation ? buildDataQuality(filteredSamples, validation) : null),
    [filteredSamples, validation],
  );
  const marketSummary = useMemo(
    () =>
      datasetInfo
        ? buildMarketSummary(
            filteredSamples,
            datasetInfo,
            referenceResult.confidence.level,
          )
        : null,
    [filteredSamples, datasetInfo, referenceResult.confidence.level],
  );

  return (
    <div className="space-y-6">
      {/* Engine version + filters (Section 11). */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-base font-semibold text-ink">Market Intelligence Dashboard</h1>
        <span className="chip border-positive/40 text-positive">
          {RESEARCH_ENGINE_VERSION}
        </span>
      </div>

      <AnalysisModeSelector />
      <div className="sticky top-0 z-20 -mx-6 bg-panel/95 px-6 py-1 backdrop-blur supports-[backdrop-filter]:bg-panel/80">
        <FilterBar />
      </div>
      <WarningsPanel />

      {/* Section 1 */}
      {datasetInfo && (
        <DatasetInfoSection
          info={datasetInfo}
          researchPositions={referenceResult.validEvents}
        />
      )}

      {/* Section 9 — executive summary up top. */}
      {marketSummary && (
        <MarketSummarySection
          summary={marketSummary}
          confidenceLevel={referenceResult.confidence.level}
        />
      )}

      {/* Section 2 */}
      <GapStatsSection stats={gapStats} />

      {/* Section 7 */}
      {dataQuality && <DataQualitySection quality={dataQuality} />}

      {/* Section 3 */}
      <GapDistributionSection dist={distribution} />

      {/* Section 4 */}
      <GapFrequencySection rows={frequency} />

      {/* Section 5 */}
      <OverviewSessionSection samples={filteredSamples} reference={reference} />

      {/* Section 6 */}
      <OverviewDailySection samples={filteredSamples} reference={reference} />

      {/* Section 8 */}
      <RareGapSection samples={filteredSamples} reference={reference} />

      {/* Raw data access. */}
      <SampleTable />
    </div>
  );
}
