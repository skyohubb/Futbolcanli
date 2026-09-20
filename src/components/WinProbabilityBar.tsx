import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles, RefreshCw, Activity, CheckCircle2, TrendingUp, ShieldAlert, Cpu } from 'lucide-react';
import { Match, WinProbabilityData } from '../types.ts';
import { apiUrl } from '../services/api.ts';

interface WinProbabilityBarProps {
  match: Match;
  autoLoad?: boolean;
  className?: string;
}

export const WinProbabilityBar: React.FC<WinProbabilityBarProps> = ({
  match,
  autoLoad = true,
  className = '',
}) => {
  const [data, setData] = useState<WinProbabilityData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const homeScore = match.score?.fullTime?.home ?? match.score?.halfTime?.home ?? 0;
  const awayScore = match.score?.fullTime?.away ?? match.score?.halfTime?.away ?? 0;
  const currentScore = `${homeScore} - ${awayScore}`;

  const fetchProbability = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl('/api/win-probability'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId: match.id,
          homeTeam: match.homeTeam.name,
          awayTeam: match.awayTeam.name,
          competition: match.competition.name,
          status: match.status,
          minute: match.minute || (match.status === 'PAUSED' ? 45 : match.status === 'FINISHED' ? 90 : 35),
          currentScore,
        }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        setData({
          ...json.data,
          source: json.source || 'gemini_ai',
          updatedAt: Date.now(),
        });
      } else {
        throw new Error(json.error || 'Olasılık hesaplanamadı');
      }
    } catch (err: any) {
      setError('Hesaplama alınırken bağlantı hatası oluştu.');
    } finally {
      setLoading(false);
    }
  }, [match.id, match.homeTeam.name, match.awayTeam.name, match.competition.name, match.status, match.minute, currentScore]);

  useEffect(() => {
    if (autoLoad && !data && !loading) {
      fetchProbability();
    }
  }, [autoLoad, fetchProbability]);

  // Fallback defaults if not loaded yet
  const homeProb = data?.homeWinProb ?? 45;
  const drawProb = data?.drawProb ?? 28;
  const awayProb = data?.awayWinProb ?? 27;

  return (
    <div
      className={`p-4 rounded-xl bg-zinc-950/80 border border-zinc-800/90 shadow-inner flex flex-col gap-3.5 ${className}`}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h4 className="text-xs font-bold text-white tracking-tight">
                Kazanma Olasılığı
              </h4>
            </div>
            <p className="text-[11px] text-zinc-400">
              Skor ({currentScore}), dakika ve oyun baskısına göre canlı modelleme
            </p>
          </div>
        </div>

        {/* Refresh button */}
        <button
          type="button"
          onClick={() => fetchProbability()}
          disabled={loading}
          className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-indigo-300 hover:border-indigo-500/40 transition-all cursor-pointer disabled:opacity-50"
          title="Yeniden Hesapla"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
        </button>
      </div>

      {/* Loading Skeleton if no data yet */}
      {loading && !data && (
        <div className="space-y-2 animate-pulse py-2">
          <div className="h-4 bg-zinc-800/80 rounded-full w-full"></div>
          <div className="h-3 bg-zinc-800/50 rounded w-2/3"></div>
        </div>
      )}

      {/* Error state */}
      {error && !data && (
        <div className="p-2.5 rounded-lg bg-red-950/30 border border-red-500/30 text-xs text-red-300 flex items-center justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => fetchProbability()}
            className="text-[11px] underline font-bold hover:text-white"
          >
            Tekrar dene
          </button>
        </div>
      )}

      {/* Visual Tripartite Win Probability Bar */}
      <div className="space-y-1.5">
        {/* Teams & Values Label Row */}
        <div className="flex items-center justify-between text-xs font-semibold px-0.5">
          {/* Home team */}
          <div className="flex items-center gap-1.5 text-emerald-400 max-w-[38%] truncate">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
            <span className="truncate" title={match.homeTeam.name}>
              {match.homeTeam.shortName || match.homeTeam.name}
            </span>
            <span className="font-mono font-bold text-white">%{homeProb}</span>
          </div>

          {/* Draw */}
          <div className="flex items-center gap-1 text-zinc-400">
            <span className="text-[11px]">Beraberlik</span>
            <span className="font-mono font-bold text-zinc-200">%{drawProb}</span>
          </div>

          {/* Away team */}
          <div className="flex items-center gap-1.5 text-indigo-400 max-w-[38%] justify-end truncate">
            <span className="font-mono font-bold text-white">%{awayProb}</span>
            <span className="truncate text-right" title={match.awayTeam.name}>
              {match.awayTeam.shortName || match.awayTeam.name}
            </span>
            <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0"></span>
          </div>
        </div>

        {/* The Graphic Bar */}
        <div className="h-3.5 w-full bg-zinc-900 rounded-full overflow-hidden p-0.5 border border-zinc-800 flex gap-0.5 shadow-inner">
          {/* Home Win Segment */}
          <div
            style={{ width: `${homeProb}%` }}
            className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-l-full transition-all duration-500 flex items-center justify-center relative group"
            title={`${match.homeTeam.name} Galibiyeti: %${homeProb}`}
          >
            {homeProb >= 18 && (
              <span className="text-[9px] font-black text-emerald-950 select-none">
                %{homeProb}
              </span>
            )}
          </div>

          {/* Draw Segment */}
          <div
            style={{ width: `${drawProb}%` }}
            className="h-full bg-gradient-to-r from-zinc-600 to-zinc-500 transition-all duration-500 flex items-center justify-center relative group"
            title={`Beraberlik: %${drawProb}`}
          >
            {drawProb >= 16 && (
              <span className="text-[9px] font-black text-zinc-950 select-none">
                %{drawProb}
              </span>
            )}
          </div>

          {/* Away Win Segment */}
          <div
            style={{ width: `${awayProb}%` }}
            className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-r-full transition-all duration-500 flex items-center justify-center relative group"
            title={`${match.awayTeam.name} Galibiyeti: %${awayProb}`}
          >
            {awayProb >= 18 && (
              <span className="text-[9px] font-black text-indigo-950 select-none">
                %{awayProb}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Momentum & Key Factors Section */}
      {data && (
        <div className="pt-2 border-t border-zinc-900 flex flex-col gap-2">
          {/* Momentum Indicator */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400 flex items-center gap-1.5 text-[11px]">
              <Activity className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span>Oyun Momenti:</span>
            </span>
            <span className="font-semibold text-amber-300 text-[11px] bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/30">
              {data.momentum}
            </span>
          </div>

          {/* Summary */}
          {data.summary && (
            <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800/70">
              {data.summary}
            </p>
          )}

          {/* Key Factors list */}
          {data.keyFactors && data.keyFactors.length > 0 && (
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                Belirleyici Faktörler
              </span>
              <ul className="space-y-1">
                {data.keyFactors.map((factor, idx) => (
                  <li
                    key={idx}
                    className="text-[11px] text-zinc-400 flex items-start gap-1.5 leading-snug"
                  >
                    <CheckCircle2 className="w-3 h-3 text-indigo-400 shrink-0 mt-0.5" />
                    <span>{factor}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
