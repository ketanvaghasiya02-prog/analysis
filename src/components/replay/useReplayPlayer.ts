/**
 * Replay playback controller (Phase 11F).
 *
 * Steps through the reconstructed historical samples in chronological order,
 * pacing each step by the REAL time gap between samples divided by the playback
 * speed (clamped to stay watchable). It only advances a cursor over already-
 * stored samples — it never generates or predicts data.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReplayTimeline } from '@/utils/replay';

const MIN_DELAY_MS = 16;
const MAX_DELAY_MS = 1200;

export interface ReplayPlayer {
  pos: number;
  playing: boolean;
  speed: number;
  atEnd: boolean;
  play: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  restart: () => void;
  next: () => void;
  prev: () => void;
  setSpeed: (s: number) => void;
  jumpTo: (pos: number) => void;
}

export function useReplayPlayer(timeline: ReplayTimeline): ReplayPlayer {
  const samples = timeline.samples;
  const last = Math.max(0, samples.length - 1);

  const [pos, setPos] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const timerRef = useRef<number | null>(null);

  // Reset whenever the occurrence (timeline) changes.
  useEffect(() => {
    setPos(0);
    setPlaying(false);
  }, [timeline]);

  // Schedule the next step while playing.
  useEffect(() => {
    if (!playing) return;
    if (pos >= last) {
      setPlaying(false);
      return;
    }
    const cur = samples[pos];
    const nxt = samples[pos + 1];
    let dtMs = 400;
    if (cur?.timestampMs != null && nxt?.timestampMs != null) {
      dtMs = Math.abs(nxt.timestampMs - cur.timestampMs);
    }
    const delay = Math.min(MAX_DELAY_MS, Math.max(MIN_DELAY_MS, dtMs / speed));
    timerRef.current = window.setTimeout(() => {
      setPos((p) => Math.min(last, p + 1));
    }, delay);
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [playing, pos, speed, samples, last]);

  const play = useCallback(() => {
    setPos((p) => (p >= last ? 0 : p));
    setPlaying(true);
  }, [last]);
  const pause = useCallback(() => setPlaying(false), []);
  const resume = useCallback(() => {
    if (pos < last) setPlaying(true);
  }, [pos, last]);
  const stop = useCallback(() => {
    setPlaying(false);
    setPos(0);
  }, []);
  const restart = useCallback(() => {
    setPos(0);
    setPlaying(true);
  }, []);
  const next = useCallback(() => {
    setPlaying(false);
    setPos((p) => Math.min(last, p + 1));
  }, [last]);
  const prev = useCallback(() => {
    setPlaying(false);
    setPos((p) => Math.max(0, p - 1));
  }, []);
  const jumpTo = useCallback(
    (p: number) => {
      setPlaying(false);
      setPos(Math.max(0, Math.min(last, p)));
    },
    [last],
  );

  return {
    pos,
    playing,
    speed,
    atEnd: pos >= last,
    play,
    pause,
    resume,
    stop,
    restart,
    next,
    prev,
    setSpeed,
    jumpTo,
  };
}
