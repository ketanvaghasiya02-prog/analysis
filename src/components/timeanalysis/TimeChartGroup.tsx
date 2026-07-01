/**
 * Time Analysis — synchronized, interactive Spot / Future / Gap charts.
 *
 * Professional financial-chart interaction over one shared zoom window:
 * wheel/pinch zoom, drag pan, synchronized across all three charts, a shared
 * crosshair + combined tooltip, double-click reset, toolbar and keyboard
 * shortcuts, and a controlled bottom range slider synced with the zoom.
 *
 * A Display Time toggle re-labels the axis and tooltip between Server / Indian
 * (IST) / UTC / Custom timezones. Changing it only changes labels — never the
 * underlying data (which stays on the immutable server timeline).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Brush,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { SeriesPoint } from '@/utils/timeAnalysis';
import { absSecToHHMM, absSecToHHMMSS, TZ_LABEL, type TzConfig, type TzKind } from '@/utils/timezone';
import { exportChartPng } from '@/utils/chartExport';
import { fmtNumber } from '@/utils/format';
import { DownloadIcon } from '@/components/common/icons';

const AXIS = {
  tick: { fill: '#64748b', fontSize: 10 },
  tickLine: false,
  axisLine: { stroke: '#1e293b' },
} as const;

const SERIES = [
  { key: 'spot', title: 'Spot Price', color: '#38bdf8' },
  { key: 'future', title: 'Future Price', color: '#a78bfa' },
  { key: 'gap', title: 'Gap', color: '#34d399' },
] as const;

const DISPLAY_TZS: TzKind[] = ['server', 'ist', 'utc', 'custom'];
const MIN_SPAN = 2;
const PLOT_LEFT = 60;
const PLOT_RIGHT_PAD = 14;

interface ChartPoint extends SeriesPoint {
  label: string; // HH:MM in display tz
  displayFull: string; // HH:MM:SS in display tz
}

function makeTooltip(displayTz: TzKind) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function SharedTooltip({ active, payload }: any) {
    if (!active || !payload || payload.length === 0) return null;
    const p = payload[0]?.payload as ChartPoint | undefined;
    if (!p) return null;
    const row = (color: string, label: string, v: number | null) => (
      <div className="flex items-center justify-between gap-4">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm" style={{ background: color }} />
          <span className="text-ink-muted">{label}</span>
        </span>
        <span className="font-mono text-ink">{v === null ? '—' : fmtNumber(v, 2)}</span>
      </div>
    );
    return (
      <div className="min-w-[9rem] rounded-md border border-panel-border bg-panel-raised px-3 py-2 text-xs shadow-lg">
        <div className="mb-1 space-y-0.5 font-mono text-[11px]">
          <div className="flex justify-between gap-4"><span className="text-ink-faint">Server</span><span className="text-ink-muted">{p.serverFull}</span></div>
          {displayTz !== 'server' && (
            <div className="flex justify-between gap-4"><span className="text-ink-faint">{TZ_LABEL[displayTz]}</span><span className="text-accent">{p.displayFull}</span></div>
          )}
        </div>
        <div className="space-y-0.5 border-t border-panel-border pt-1">
          {row('#38bdf8', 'Spot', p.spot)}
          {row('#a78bfa', 'Future', p.future)}
          {row('#34d399', 'Gap', p.gap)}
        </div>
      </div>
    );
  };
}

function ToolBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="rounded-md border border-panel-border bg-panel px-2 py-1 text-[11px] font-medium text-ink-muted transition-colors hover:border-accent hover:text-accent"
    >
      {children}
    </button>
  );
}

export function TimeChartGroup({
  series,
  id,
  displayTz,
  cfg,
  onDisplayTzChange,
}: {
  series: SeriesPoint[];
  id: number;
  displayTz: TzKind;
  cfg: TzConfig;
  onDisplayTzChange: (tz: TzKind) => void;
}) {
  const n = series.length;
  const syncId = `ta-${id}`;

  // Display labels derive from the immutable absSec — toggling tz only re-labels.
  const data = useMemo<ChartPoint[]>(
    () => series.map((p) => ({ ...p, label: absSecToHHMM(p.absSec, displayTz, cfg), displayFull: absSecToHHMMSS(p.absSec, displayTz, cfg) })),
    [series, displayTz, cfg],
  );

  const [win, setWin] = useState<[number, number]>(() => [0, Math.max(0, n - 1)]);
  useEffect(() => setWin([0, Math.max(0, n - 1)]), [series, n]);

  const winRef = useRef(win);
  winRef.current = win;
  const [lo, hi] = win;
  const span = Math.max(1, hi - lo);
  const windowed = useMemo(() => data.slice(lo, hi + 1), [data, lo, hi]);

  const refs = {
    spot: useRef<HTMLDivElement>(null),
    future: useRef<HTMLDivElement>(null),
    gap: useRef<HTMLDivElement>(null),
  };

  const applyWin = useCallback(
    (nlo: number, nhi: number) => {
      let a = Math.round(nlo);
      let b = Math.round(nhi);
      if (b < a) [a, b] = [b, a];
      if (b - a < MIN_SPAN) b = a + MIN_SPAN;
      if (a < 0) { b -= a; a = 0; }
      if (b > n - 1) { a -= b - (n - 1); b = n - 1; }
      if (a < 0) a = 0;
      setWin([a, b]);
    },
    [n],
  );

  const zoomAround = useCallback(
    (center: number, factor: number) => {
      const [l, h] = winRef.current;
      const s = Math.max(1, h - l);
      const newSpan = Math.max(MIN_SPAN, Math.min(n - 1, Math.round(s * factor)));
      const ratio = s > 0 ? (center - l) / s : 0.5;
      const a = center - ratio * newSpan;
      applyWin(a, a + newSpan);
    },
    [n, applyWin],
  );

  const panBy = useCallback((d: number) => { const [l, h] = winRef.current; applyWin(l + d, h + d); }, [applyWin]);
  const reset = useCallback(() => setWin([0, Math.max(0, n - 1)]), [n]);
  const centerIdx = () => { const [l, h] = winRef.current; return (l + h) / 2; };
  const zoomIn = () => zoomAround(centerIdx(), 0.7);
  const zoomOut = () => zoomAround(centerIdx(), 1 / 0.7);

  useEffect(() => {
    const els = [refs.spot.current, refs.future.current, refs.gap.current].filter(Boolean) as HTMLElement[];
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const el = e.currentTarget as HTMLElement;
      const rect = el.getBoundingClientRect();
      const [l, h] = winRef.current;
      const s = Math.max(1, h - l);
      const plotRight = rect.width - PLOT_RIGHT_PAD;
      const frac = Math.max(0, Math.min(1, (e.clientX - rect.left - PLOT_LEFT) / Math.max(1, plotRight - PLOT_LEFT)));
      const idx = l + frac * s;
      const base = e.deltaY < 0 ? 0.85 : 1 / 0.85;
      zoomAround(idx, e.ctrlKey ? (base < 1 ? 0.7 : 1 / 0.7) : base);
    };
    els.forEach((el) => el.addEventListener('wheel', onWheel, { passive: false }));
    return () => els.forEach((el) => el.removeEventListener('wheel', onWheel));
  }, [zoomAround, refs.spot, refs.future, refs.gap]);

  const onChartPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const el = e.currentTarget as HTMLElement;
    const w = el.getBoundingClientRect().width;
    const [l, h] = winRef.current;
    const startX = e.clientX;
    const s = Math.max(1, h - l);
    const plotW = Math.max(1, w - (PLOT_LEFT + PLOT_RIGHT_PAD));
    const move = (ev: PointerEvent) => {
      const deltaIdx = -Math.round(((ev.clientX - startX) / plotW) * s);
      applyWin(l + deltaIdx, h + deltaIdx);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = Math.max(1, Math.round(span * 0.15));
    switch (e.key) {
      case 'ArrowLeft': e.preventDefault(); panBy(-step); break;
      case 'ArrowRight': e.preventDefault(); panBy(step); break;
      case '+': case '=': e.preventDefault(); zoomIn(); break;
      case '-': case '_': e.preventDefault(); zoomOut(); break;
      case 'r': case 'R': e.preventDefault(); reset(); break;
      default: break;
    }
  };

  const exportPng = () => {
    ([['spot', 'Spot'], ['future', 'Future'], ['gap', 'Gap']] as const).forEach(([k, name], i) => {
      setTimeout(() => exportChartPng(refs[k].current, `TimeAnalysis_${name}`), i * 250);
    });
  };

  const interactive = n > MIN_SPAN;
  const Tip = useMemo(() => makeTooltip(displayTz), [displayTz]);

  return (
    <div tabIndex={0} onKeyDown={onKeyDown} className="space-y-3 rounded-lg outline-none focus:ring-1 focus:ring-accent/40">
      {/* Display Time toggle */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="stat-label mr-1">Display Time</span>
        {DISPLAY_TZS.map((tz) => (
          <button
            key={tz}
            type="button"
            onClick={() => onDisplayTzChange(tz)}
            className={[
              'rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors',
              displayTz === tz ? 'border-accent/70 bg-accent/10 text-accent' : 'border-panel-border bg-panel text-ink-muted hover:border-accent hover:text-accent',
            ].join(' ')}
          >
            {TZ_LABEL[tz]}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="stat-label mr-1">Zoom</span>
        <ToolBtn onClick={reset} title="Reset zoom (R)">Reset Zoom</ToolBtn>
        <ToolBtn onClick={zoomIn} title="Zoom in (+)">Zoom In</ToolBtn>
        <ToolBtn onClick={zoomOut} title="Zoom out (−)">Zoom Out</ToolBtn>
        <ToolBtn onClick={reset} title="Fit all data">Fit Data</ToolBtn>
        <button
          type="button"
          onClick={exportPng}
          title="Export the three charts as PNG"
          className="flex items-center gap-1 rounded-md border border-panel-border bg-panel px-2 py-1 text-[11px] font-medium text-ink-muted transition-colors hover:border-accent hover:text-accent"
        >
          <DownloadIcon className="text-xs" /> Export PNG
        </button>
        <span className="ml-auto text-[10px] text-ink-faint">wheel/pinch = zoom · drag = pan · dbl-click = reset · ←/→ pan · +/− zoom · R reset</span>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {SERIES.map((s) => (
          <div key={s.key} className="card p-4">
            <header className="mb-2 flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
              <h4 className="text-xs font-semibold uppercase tracking-wide text-ink">{s.title}</h4>
            </header>
            <div
              ref={refs[s.key]}
              onPointerDown={interactive ? onChartPointerDown : undefined}
              onDoubleClick={reset}
              className={['h-52 w-full select-none', interactive ? 'cursor-ew-resize' : ''].join(' ')}
              style={{ touchAction: 'none' }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart syncId={syncId} data={windowed} margin={{ top: 8, right: 12, bottom: 0, left: -6 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="label" {...AXIS} minTickGap={28} />
                  <YAxis {...AXIS} width={58} domain={['auto', 'auto']} tickFormatter={(v: number) => fmtNumber(v, 2)} />
                  <Tooltip cursor={{ stroke: '#64748b', strokeDasharray: '3 3' }} content={<Tip />} />
                  <Line type="monotone" dataKey={s.key} stroke={s.color} strokeWidth={1.75} dot={false} isAnimationActive={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom range slider — controlled, synced with zoom */}
      {n > MIN_SPAN && (
        <div className="card px-4 pb-2 pt-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="stat-label">Range</span>
            <span className="font-mono text-[10px] text-ink-faint">{windowed[0]?.label} – {windowed[windowed.length - 1]?.label} · {windowed.length}/{n}</span>
          </div>
          <div className="h-16 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 4, right: 12, bottom: 0, left: -6 }}>
                <XAxis dataKey="label" hide />
                <YAxis hide domain={['auto', 'auto']} />
                <Line type="monotone" dataKey="gap" stroke="#334155" strokeWidth={1} dot={false} isAnimationActive={false} connectNulls />
                <Brush
                  dataKey="label"
                  height={22}
                  startIndex={lo}
                  endIndex={hi}
                  stroke="#38bdf8"
                  fill="#0b1220"
                  travellerWidth={8}
                  onChange={(r: { startIndex?: number; endIndex?: number }) => {
                    if (r && typeof r.startIndex === 'number' && typeof r.endIndex === 'number') {
                      if (r.startIndex !== lo || r.endIndex !== hi) applyWin(r.startIndex, r.endIndex);
                    }
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
