/**
 * Historical Strategy Finder — execution orchestrator hook (Phase 11B).
 *
 * Runs the Research Engine sequentially across every READY combination, one at
 * a time, yielding to the browser between strategies so the table updates live.
 * Handles caching (identical strategies are never rerun), the
 * READY → RUNNING → COMPLETED / FAILED / CACHED lifecycle, pause / resume /
 * stop, per-strategy error isolation, and progress timing.
 *
 * It NEVER ranks, scores, compares or recommends — it only executes and stores.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GapSample } from '@/types/gap';
import type { StrategyCombination } from '@/utils/strategyFinder';
import {
  executeStrategy,
  strategyCacheKey,
  type StrategyExecution,
  type StrategyResearchResult,
} from '@/utils/strategyExecution';

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export interface ExecutionProgress {
  total: number;
  completed: number;
  cached: number;
  failed: number;
  running: number;
  remaining: number;
  processed: number;
  elapsedMs: number;
  etaMs: number | null;
  avgExecMs: number | null;
  speed: number; // strategies per second
}

export interface StrategyExecutionController {
  executions: StrategyExecution[];
  progress: ExecutionProgress;
  running: boolean;
  paused: boolean;
  start: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  reset: () => void;
}

export function useStrategyExecution(
  readyCombos: StrategyCombination[],
  samples: GapSample[],
  minEvents: number,
): StrategyExecutionController {
  const [executions, setExecutions] = useState<StrategyExecution[]>([]);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);

  // Source-of-truth refs (the async loop reads/writes these, not state).
  const execRef = useRef<StrategyExecution[]>([]);
  const comboRef = useRef<StrategyCombination[]>([]);
  const samplesRef = useRef<GapSample[]>(samples);
  const minEventsRef = useRef<number>(minEvents);
  const cacheRef = useRef<Map<string, StrategyResearchResult>>(new Map());
  const prevSamplesRef = useRef<GapSample[] | null>(null);

  const runningRef = useRef(false);
  const pausedRef = useRef(false);
  const stoppedRef = useRef(false);
  const runStartRef = useRef(0);
  const accumMsRef = useRef(0);
  const execTimesRef = useRef<number[]>([]);

  const commit = useCallback(() => {
    setExecutions(execRef.current.slice());
  }, []);

  // Rebuild executions whenever the READY set, dataset, or minEvents change.
  // A dataset change also invalidates the cache.
  useEffect(() => {
    if (prevSamplesRef.current !== samples) {
      cacheRef.current.clear();
      prevSamplesRef.current = samples;
    }
    // Hard-stop any in-flight run.
    stoppedRef.current = true;
    runningRef.current = false;
    pausedRef.current = false;

    samplesRef.current = samples;
    minEventsRef.current = minEvents;
    comboRef.current = readyCombos;
    execRef.current = readyCombos.map((c) => ({
      id: c.id,
      entryGap: c.entryGap,
      recoveryGap: c.recoveryGap,
      stopLoss: c.stopLoss,
      status: 'READY',
      result: null,
      error: null,
    }));
    accumMsRef.current = 0;
    execTimesRef.current = [];

    setRunning(false);
    setPaused(false);
    setElapsedMs(0);
    commit();
  }, [readyCombos, samples, minEvents, commit]);

  // Live elapsed clock while running.
  useEffect(() => {
    if (!running || paused) return;
    const id = window.setInterval(() => {
      setElapsedMs(accumMsRef.current + (nowMs() - runStartRef.current));
    }, 200);
    return () => window.clearInterval(id);
  }, [running, paused]);

  const schedule = (fn: () => void) => window.setTimeout(fn, 0);

  const processNext = useCallback(() => {
    if (stoppedRef.current || pausedRef.current) return;

    const list = execRef.current;
    const idx = list.findIndex((e) => e.status === 'READY');
    if (idx === -1) {
      // Finished — accumulate the final segment and stop.
      accumMsRef.current += nowMs() - runStartRef.current;
      runningRef.current = false;
      setRunning(false);
      setElapsedMs(accumMsRef.current);
      commit();
      return;
    }

    const combo = comboRef.current[idx]!;
    const ckey = strategyCacheKey(combo);

    // Cache hit — load the stored result without rerunning the engine.
    if (cacheRef.current.has(ckey)) {
      list[idx] = { ...list[idx]!, status: 'CACHED', result: cacheRef.current.get(ckey)!, error: null };
      commit();
      schedule(processNext);
      return;
    }

    // Mark RUNNING and paint, then run the engine on the next tick.
    list[idx] = { ...list[idx]!, status: 'RUNNING' };
    commit();
    schedule(() => {
      if (stoppedRef.current) return;
      try {
        const result = executeStrategy(samplesRef.current, combo, minEventsRef.current);
        cacheRef.current.set(ckey, result);
        execTimesRef.current.push(result.executionMs);
        list[idx] = { ...list[idx]!, status: 'COMPLETED', result, error: null };
      } catch (err) {
        list[idx] = {
          ...list[idx]!,
          status: 'FAILED',
          result: null,
          error: err instanceof Error ? err.message : String(err),
        };
      }
      commit();
      schedule(processNext);
    });
  }, [commit]);

  const start = useCallback(() => {
    if (runningRef.current) return;
    if (!execRef.current.some((e) => e.status === 'READY')) return;
    stoppedRef.current = false;
    pausedRef.current = false;
    runningRef.current = true;
    runStartRef.current = nowMs();
    setRunning(true);
    setPaused(false);
    schedule(processNext);
  }, [processNext]);

  const pause = useCallback(() => {
    if (!runningRef.current || pausedRef.current) return;
    pausedRef.current = true;
    accumMsRef.current += nowMs() - runStartRef.current;
    setPaused(true);
  }, []);

  const resume = useCallback(() => {
    if (!runningRef.current || !pausedRef.current) return;
    pausedRef.current = false;
    runStartRef.current = nowMs();
    setPaused(false);
    schedule(processNext);
  }, [processNext]);

  const stop = useCallback(() => {
    if (!runningRef.current && !pausedRef.current) return;
    if (!pausedRef.current) accumMsRef.current += nowMs() - runStartRef.current;
    stoppedRef.current = true;
    runningRef.current = false;
    pausedRef.current = false;
    setRunning(false);
    setPaused(false);
  }, []);

  const reset = useCallback(() => {
    stoppedRef.current = true;
    runningRef.current = false;
    pausedRef.current = false;
    execRef.current = comboRef.current.map((c) => ({
      id: c.id,
      entryGap: c.entryGap,
      recoveryGap: c.recoveryGap,
      stopLoss: c.stopLoss,
      status: 'READY',
      result: null,
      error: null,
    }));
    accumMsRef.current = 0;
    execTimesRef.current = [];
    setRunning(false);
    setPaused(false);
    setElapsedMs(0);
    commit();
  }, [commit]);

  const progress = useMemo<ExecutionProgress>(() => {
    let completed = 0;
    let cached = 0;
    let failed = 0;
    let runningCount = 0;
    let ready = 0;
    for (const e of executions) {
      if (e.status === 'COMPLETED') completed += 1;
      else if (e.status === 'CACHED') cached += 1;
      else if (e.status === 'FAILED') failed += 1;
      else if (e.status === 'RUNNING') runningCount += 1;
      else ready += 1;
    }
    const total = executions.length;
    const processed = completed + cached + failed;
    const remaining = ready + runningCount;
    const elapsedSec = elapsedMs / 1000;
    const speed = elapsedSec > 0 ? processed / elapsedSec : 0;
    const times = execTimesRef.current;
    const avgExecMs = times.length ? times.reduce((a, b) => a + b, 0) / times.length : null;
    const etaMs = speed > 0 && remaining > 0 ? (remaining / speed) * 1000 : remaining === 0 ? 0 : null;
    return {
      total,
      completed,
      cached,
      failed,
      running: runningCount,
      remaining,
      processed,
      elapsedMs,
      etaMs,
      avgExecMs,
      speed,
    };
  }, [executions, elapsedMs]);

  return { executions, progress, running, paused, start, pause, resume, stop, reset };
}
