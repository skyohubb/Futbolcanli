import React from 'react';
import { Radio, RefreshCw, Sparkles, Activity } from 'lucide-react';
import { NotificationCenter } from './NotificationCenter.tsx';
import { GoalSignal } from '../services/notificationService.ts';

interface HeaderProps {
  liveCount: number;
  upcomingCount: number;
  totalCount: number;
  lastUpdated: number;
  isLoading: boolean;
  onRefresh: () => void;
  autoRefresh: boolean;
  setAutoRefresh: (val: boolean) => void;
  recentSignals: GoalSignal[];
  activeToast: GoalSignal | null;
  onCloseToast: () => void;
  onSelectMatch?: (matchId: number) => void;
}

export const Header: React.FC<HeaderProps> = ({
  liveCount,
  upcomingCount,
  totalCount,
  lastUpdated,
  isLoading,
  onRefresh,
  autoRefresh,
  setAutoRefresh,
  recentSignals,
  activeToast,
  onCloseToast,
  onSelectMatch,
}) => {
  const formattedTime = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '';

  return (
    <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-3">
        {/* Brand & Live Indicator */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold shadow-sm">
            <Activity className="w-5 h-5 animate-pulse text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white">
                Canlı Maç Tahminleri
              </h1>
            </div>
            <p className="text-xs text-zinc-400 flex items-center gap-2 mt-0.5">
              <span>Canlı ve günün oynanacak maç tahminleri</span>
              {formattedTime && (
                <span className="text-zinc-500 hidden md:inline">• Son Güncelleme: {formattedTime}</span>
              )}
            </p>
          </div>
        </div>

        {/* Quick Stats & Controls */}
        <div className="flex items-center gap-2 sm:gap-3 ml-auto">
          {/* Live badge */}
          {liveCount > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold animate-pulse">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              <span>{liveCount} Canlı</span>
            </div>
          )}

          {/* Upcoming badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800/80 border border-zinc-700/60 text-zinc-300 text-xs font-medium">
            <span>{upcomingCount} Oynanacak</span>
          </div>

          {/* Auto-refresh toggle */}
          <button
            type="button"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors flex items-center gap-1.5 ${
              autoRefresh
                ? 'bg-emerald-950/40 border-emerald-600/40 text-emerald-400'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
            title={autoRefresh ? 'Otomatik yenileme devrede (45 sn)' : 'Otomatik yenilemeyi aç'}
          >
            <Radio className={`w-3.5 h-3.5 ${autoRefresh ? 'text-emerald-400' : 'text-zinc-500'}`} />
            <span className="hidden md:inline">Oto-Yenile</span>
          </button>

          {/* Browser Notification & Signals Alert Center */}
          <NotificationCenter
            recentSignals={recentSignals}
            activeToast={activeToast}
            onCloseToast={onCloseToast}
            onSelectMatch={onSelectMatch}
          />

          {/* Refresh Button */}
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-900 text-xs font-medium transition active:scale-95 disabled:opacity-60 cursor-pointer shadow"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Yenile</span>
          </button>
        </div>
      </div>
    </header>
  );
};
