import React, { useState, useEffect, useMemo } from 'react';
import { Timer, Radio, Flame, PauseCircle } from 'lucide-react';
import { Match } from '../types.ts';

interface LiveChronometerProps {
  match: Match;
  variant?: 'banner' | 'compact' | 'badge';
  className?: string;
}

export const LiveChronometer: React.FC<LiveChronometerProps> = ({
  match,
  variant = 'badge',
  className = '',
}) => {
  const isPaused = match.status === 'PAUSED';
  const isLive = match.status === 'IN_PLAY' || isPaused;

  // Base starting minutes from server or calculated from kickoff time
  const initialSeconds = useMemo(() => {
    if (!isLive) return 0;
    if (isPaused) return 45 * 60;

    if (match.minute !== undefined && match.minute > 0) {
      return match.minute * 60;
    }

    try {
      const startMs = new Date(match.utcDate).getTime();
      const diffSec = Math.floor((Date.now() - startMs) / 1000);
      if (diffSec > 0 && diffSec < 120 * 60) {
        return diffSec;
      }
    } catch {
      // Ignore
    }

    return 32 * 60; // Sensible default fallback if kickoff time is not syncable
  }, [match.minute, match.utcDate, isLive, isPaused]);

  const [elapsedSeconds, setElapsedSeconds] = useState<number>(initialSeconds);

  // Sync when match props update
  useEffect(() => {
    setElapsedSeconds(initialSeconds);
  }, [initialSeconds]);

  // Real-time ticking interval for live in-play matches
  useEffect(() => {
    if (match.status !== 'IN_PLAY') return;

    const interval = setInterval(() => {
      setElapsedSeconds((prev) => {
        // Cap at 98 minutes (standard max match time)
        if (prev >= 98 * 60) return prev;
        return prev + 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [match.status]);

  if (!isLive) return null;

  const currentMin = Math.floor(elapsedSeconds / 60);
  const currentSec = elapsedSeconds % 60;

  // Format minute with stoppage time consideration
  let minuteDisplay = `${currentMin}'`;
  let periodLabel = '1. DEVRE';

  if (isPaused) {
    minuteDisplay = "45' İY";
    periodLabel = 'DEVRE ARASI';
  } else if (currentMin <= 45) {
    periodLabel = '1. DEVRE';
    minuteDisplay = `${currentMin}'`;
  } else if (currentMin > 45 && currentMin <= 48) {
    periodLabel = '1. DEVRE (+UZATMA)';
    minuteDisplay = `45+${currentMin - 45}'`;
  } else if (currentMin > 48 && currentMin <= 90) {
    periodLabel = '2. DEVRE';
    minuteDisplay = `${currentMin}'`;
  } else if (currentMin > 90) {
    periodLabel = '2. DEVRE (+UZATMA)';
    minuteDisplay = `90+${currentMin - 90}'`;
  }

  // Second hand angle for animated clock dial (0 to 360 deg)
  const secondHandAngle = (currentSec * 6) % 360;

  // 1. BANNER VARIANT: Prominent full-width live strip atop the match card
  if (variant === 'banner') {
    return (
      <div
        className={`w-full px-3.5 py-2 bg-gradient-to-r from-red-950/80 via-zinc-950 to-red-950/80 border-b border-red-500/40 flex items-center justify-between gap-2 text-xs select-none ${className}`}
      >
        {/* Left: Animated LIVE Tag */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-600/20 text-red-400 font-black tracking-wider text-[11px] border border-red-500/50 shadow-sm shadow-red-900/40">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-85"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            <span className="animate-pulse">LIVE</span>
            <Radio className="w-3 h-3 text-red-400 animate-pulse hidden sm:inline" />
          </div>

          <span className="text-[11px] font-semibold text-zinc-300 hidden md:inline">
            Canlı Takip
          </span>
        </div>

        {/* Center: Running Chronometer with SVG Dial */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-black/60 border border-red-500/30 shadow-inner">
          {/* Animated Stopwatch Dial */}
          <div className="relative w-5 h-5 shrink-0 flex items-center justify-center">
            {isPaused ? (
              <PauseCircle className="w-4 h-4 text-amber-400 animate-pulse" />
            ) : (
              <svg className="w-5 h-5 transform -rotate-90" viewBox="0 0 24 24">
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                  fill="none"
                  stroke="#3f3f46"
                  strokeWidth="2"
                />
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="2"
                  strokeDasharray="56.5"
                  strokeDashoffset={56.5 - (56.5 * (currentSec % 60)) / 60}
                  className="transition-all duration-300"
                />
                {/* Center tick indicator */}
                <line
                  x1="12"
                  y1="12"
                  x2="12"
                  y2="5"
                  stroke="#ffffff"
                  strokeWidth="2"
                  strokeLinecap="round"
                  style={{
                    transformOrigin: '12px 12px',
                    transform: `rotate(${secondHandAngle}deg)`,
                    transition: 'transform 0.2s linear',
                  }}
                />
              </svg>
            )}
          </div>

          {/* Minute & Seconds Counter */}
          <div className="flex items-baseline gap-1 font-mono">
            <span className="text-sm sm:text-base font-black text-white tracking-tight">
              {minuteDisplay}
            </span>
            {!isPaused && (
              <span className="text-[11px] font-bold text-red-400">
                :{String(currentSec).padStart(2, '0')}
              </span>
            )}
          </div>

          {/* Period Badge */}
          <span
            className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
              isPaused
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'bg-zinc-800 text-zinc-300'
            }`}
          >
            {periodLabel}
          </span>
        </div>

        {/* Right: Live Signal Status */}
        <div className="flex items-center gap-1.5 text-right">
          {match.prediction?.firstHalf && match.prediction.firstHalf.over05Prob >= 72 && currentMin <= 45 ? (
            <span className="flex items-center gap-1 text-[11px] font-extrabold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30 animate-pulse">
              <Flame className="w-3 h-3 text-amber-400" />
              <span className="hidden sm:inline">İY Gol Sinyali</span>
            </span>
          ) : (
            <span className="text-[10px] text-zinc-400 font-medium hidden sm:inline">
              Anlık Skor Akışı
            </span>
          )}
        </div>
      </div>
    );
  }

  // 2. COMPACT VARIANT: Directly embedded in the score box
  if (variant === 'compact') {
    return (
      <div className={`flex flex-col items-center mt-1.5 select-none ${className}`}>
        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-950/70 border border-red-500/40 shadow-xs">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
          </span>

          <span className="text-[11px] font-black text-white font-mono tracking-tight flex items-center gap-0.5">
            <Timer className="w-3 h-3 text-red-400 animate-spin-slow" style={{ animationDuration: '4s' }} />
            <span>{minuteDisplay}</span>
            {!isPaused && (
              <span className="text-[9px] text-red-400 font-normal">
                :{String(currentSec).padStart(2, '0')}"
              </span>
            )}
          </span>
        </div>
        <span className="text-[9px] font-semibold text-red-400 uppercase tracking-wider mt-0.5">
          {periodLabel}
        </span>
      </div>
    );
  }

  // 3. BADGE VARIANT: Top status badge
  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/20 text-red-400 font-black text-xs border border-red-500/40 shadow-xs select-none ${className}`}
    >
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-80"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
      </span>

      <span className="tracking-wide">LIVE</span>

      <span className="w-1 h-1 rounded-full bg-red-400/60"></span>

      <span className="font-mono text-white font-bold flex items-center gap-0.5">
        <Timer className="w-3 h-3 text-red-400" />
        <span>{minuteDisplay}</span>
        {!isPaused && (
          <span className="text-[10px] text-red-400">
            :{String(currentSec).padStart(2, '0')}
          </span>
        )}
      </span>
    </div>
  );
};
