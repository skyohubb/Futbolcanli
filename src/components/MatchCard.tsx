import React, { useState } from 'react';
import { Sparkles, Clock, Target, TrendingUp, ChevronDown, ChevronUp, ShieldCheck, Zap, Flame, Timer, BarChart2, Star } from 'lucide-react';
import { Match } from '../types.ts';
import { MatchTimelineChart } from './MatchTimelineChart.tsx';
import { LiveChronometer } from './LiveChronometer.tsx';
import { WinProbabilityBar } from './WinProbabilityBar.tsx';
import { apiUrl } from '../services/api.ts';

interface MatchCardProps {
  match: Match;
  isFavorite?: boolean;
  onToggleFavorite?: (matchId: number) => void;
}

export const MatchCard: React.FC<MatchCardProps> = ({ match, isFavorite = false, onToggleFavorite }) => {
  const [showDetails, setShowDetails] = useState(false);
  const [showChart, setShowChart] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  const isLive = match.status === 'IN_PLAY' || match.status === 'PAUSED';
  const isFinished = match.status === 'FINISHED';
  const [showWinProb, setShowWinProb] = useState<boolean>(false);

  // Format kickoff time in Turkish locale
  const matchDate = new Date(match.utcDate);
  const kickoffTime = matchDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const kickoffDate = matchDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });

  const homeScore = match.score?.fullTime?.home;
  const awayScore = match.score?.fullTime?.away;

  // Confidence color
  const getConfidenceBadge = (level: string) => {
    switch (level) {
      case 'Yüksek':
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case 'Orta':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      default:
        return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    }
  };

  const handleFetchAiAnalysis = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (aiAnalysis || isLoadingAi) return;

    setIsLoadingAi(true);
    try {
      const res = await fetch(apiUrl('/api/ai-analysis'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId: match.id,
          homeTeam: match.homeTeam.name,
          awayTeam: match.awayTeam.name,
          competition: match.competition.name,
          status: match.status,
          currentScore: isLive ? `${homeScore} - ${awayScore}` : undefined,
        }),
      });
      const data = await res.json();
      if (data.analysis) {
        setAiAnalysis(data.analysis);
        setShowDetails(true);
      }
    } catch (err) {
      console.error('AI fetch error:', err);
    } finally {
      setIsLoadingAi(false);
    }
  };

  return (
    <div
      id={`match-${match.id}`}
      className={`rounded-2xl border transition-all duration-200 overflow-hidden scroll-mt-24 ${
        isLive
          ? 'bg-zinc-900/90 border-red-500/40 hover:border-red-500/60 shadow-xl shadow-red-950/30'
          : 'bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700/80'
      }`}
    >
      {/* 1. DİKKAT ÇEKİCİ CANLI KRONOMETRE VE LIVE ŞERİDİ (CANLI MAÇLAR İÇİN) */}
      {isLive && <LiveChronometer match={match} variant="banner" />}

      {/* Top Bar: League & Status */}
      <div className="px-4 py-2.5 bg-zinc-950/50 border-b border-zinc-800/60 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 overflow-hidden">
          {match.competition.emblem ? (
            <img
              src={match.competition.emblem}
              alt={match.competition.name}
              className="w-4 h-4 object-contain"
              referrerPolicy="no-referrer"
            />
          ) : match.area.flag ? (
            <img
              src={match.area.flag}
              alt={match.area.name}
              className="w-4 h-3 object-cover rounded-xs"
              referrerPolicy="no-referrer"
            />
          ) : null}
          <span className="font-medium text-zinc-300 truncate">{match.competition.name}</span>
          {match.matchday && (
            <span className="text-zinc-500 text-[11px] hidden sm:inline">• {match.matchday}. Hafta</span>
          )}
        </div>

        {/* Status indicator and Favorite button */}
        <div className="flex items-center gap-2">
          {isLive ? (
            <LiveChronometer match={match} variant="badge" />
          ) : isFinished ? (
            <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 text-[11px] font-medium">
              Bitti
            </span>
          ) : (
            <div className="flex items-center gap-1 text-zinc-400 font-medium text-[11px]">
              <Clock className="w-3 h-3 text-zinc-500" />
              <span>{kickoffDate}, {kickoffTime}</span>
            </div>
          )}

          {/* Favorite Star Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite?.(match.id);
            }}
            className={`p-1.5 rounded-lg border transition-all cursor-pointer flex items-center justify-center ${
              isFavorite
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-400 hover:bg-amber-500/30 shadow-xs shadow-amber-950/20'
                : 'bg-zinc-900/90 border-zinc-800 text-zinc-500 hover:text-amber-400 hover:border-zinc-700'
            }`}
            title={isFavorite ? 'Favorilerimden Çıkar' : 'Favorilerime Ekle'}
            aria-label={isFavorite ? 'Favorilerimden Çıkar' : 'Favorilerime Ekle'}
          >
            <Star
              className={`w-3.5 h-3.5 transition-transform active:scale-125 ${
                isFavorite ? 'fill-amber-400 text-amber-400' : 'text-zinc-400 hover:text-amber-400'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Center: Teams & Score - flex, tam oturan responsive */}
      <div className="p-3 sm:p-5">
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Home Team */}
          <div className="flex-1 min-w-0 flex items-center gap-2 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-zinc-800/80 p-1.5 flex items-center justify-center shrink-0 border border-zinc-700/40">
              {match.homeTeam.crest ? (
                <img
                  src={match.homeTeam.crest}
                  alt={match.homeTeam.name}
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="text-xs font-bold text-zinc-400">{match.homeTeam.tla || 'EV'}</div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm sm:text-[15px] text-zinc-100 truncate leading-tight">
                {match.homeTeam.shortName || match.homeTeam.name}
              </h4>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <span className="text-[11px] text-zinc-400">Ev Sahibi</span>
                {match.homeTeam.elo && (
                  <span className="inline-flex items-center text-[10px] px-1.5 py-0.2 rounded bg-blue-950/50 text-blue-300 border border-blue-800/40 font-mono font-medium" title="Elo Rating">
                    Elo {match.homeTeam.elo.rating}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Score or VS - sabit genislik, tam ortada */}
          <div className="shrink-0 w-[84px] sm:w-[96px] flex flex-col items-center justify-center">
            {isLive || isFinished ? (
              <div className="text-center flex flex-col items-center">
                <div
                  className={`text-base sm:text-xl font-black tracking-tight px-2 py-1 rounded-xl transition-all min-w-[64px] text-center ${
                    isLive
                      ? 'bg-red-950/40 text-white border border-red-500/50 shadow-lg shadow-red-950/30'
                      : 'bg-zinc-950 text-white border border-zinc-800'
                  }`}
                >
                  {homeScore ?? 0} : {awayScore ?? 0}
                </div>

                {isLive ? (
                  <LiveChronometer match={match} variant="compact" />
                ) : (
                  <span className="text-[10px] text-zinc-500 font-medium tracking-wide uppercase mt-1 block">
                    MS
                  </span>
                )}
              </div>
            ) : (
              <div className="text-center">
                <span className="text-xs font-bold text-zinc-500 px-2 py-1 rounded bg-zinc-800/50">VS</span>
                <span className="text-[11px] text-zinc-400 block mt-1">{kickoffTime}</span>
              </div>
            )}
          </div>

          {/* Away Team */}
          <div className="flex-1 min-w-0 flex items-center justify-end gap-2 sm:gap-3 text-right">
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm sm:text-[15px] text-zinc-100 truncate leading-tight">
                {match.awayTeam.shortName || match.awayTeam.name}
              </h4>
              <div className="flex items-center justify-end gap-1.5 mt-0.5 flex-wrap">
                {match.awayTeam.elo && (
                  <span className="inline-flex items-center text-[10px] px-1.5 py-0.2 rounded bg-blue-950/50 text-blue-300 border border-blue-800/40 font-mono font-medium" title="Elo Rating">
                    Elo {match.awayTeam.elo.rating}
                  </span>
                )}
                <span className="text-[11px] text-zinc-400">Deplasman</span>
              </div>
            </div>
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-zinc-800/80 p-1.5 flex items-center justify-center shrink-0 border border-zinc-700/40">
              {match.awayTeam.crest ? (
                <img
                  src={match.awayTeam.crest}
                  alt={match.awayTeam.name}
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="text-xs font-bold text-zinc-400">{match.awayTeam.tla || 'DEP'}</div>
              )}
            </div>
          </div>
        </div>

        {/* Prediction Hero Box */}
        <div className="mt-4 p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800/90 space-y-3">
          {/* ÖZEL İLK YARI GOL TAHMİNİ (KULLANICININ ÖNCELİKLİ İSTEĞİ) */}
          {match.prediction.firstHalf && (
            <div className="p-3 rounded-xl bg-gradient-to-r from-amber-950/30 via-zinc-900/80 to-zinc-900/50 border border-amber-500/30 space-y-2.5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    <Flame className="w-4 h-4 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                        İlk Yarı Gol Tahmini (İY)
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-medium">
                        Öncelikli Odak
                      </span>
                    </div>
                    <div className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
                      <span>{match.prediction.firstHalf.recommendation}</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        %{match.prediction.firstHalf.over05Prob} İhtimal
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-right">
                  <div className="bg-zinc-950/80 px-2.5 py-1 rounded-lg border border-amber-500/20">
                    <span className="text-[10px] text-zinc-400 block">İY Skor Tahmini</span>
                    <span className="text-sm font-black text-amber-300 font-mono">
                      {match.prediction.firstHalf.predictedHalfScore}
                    </span>
                  </div>
                </div>
              </div>

              {/* İY 0.5 Üst Olasılık Çubuğu */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-amber-300 font-medium">
                    İY 0.5 Üst: <span className="font-bold">%{match.prediction.firstHalf.over05Prob}</span>
                  </span>
                  <span className="text-zinc-400 font-medium">
                    İY 1.5 Üst: <span className="text-zinc-200 font-bold">%{match.prediction.firstHalf.over15Prob}</span>
                  </span>
                  <span className="text-zinc-400 font-medium">
                    İY 0.5 Alt: <span className="font-bold">%{match.prediction.firstHalf.under05Prob}</span>
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden flex">
                  <div
                    style={{ width: `${match.prediction.firstHalf.over05Prob}%` }}
                    className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-500"
                    title={`İY 0.5 Üst: %${match.prediction.firstHalf.over05Prob}`}
                  />
                  <div
                    style={{ width: `${match.prediction.firstHalf.under05Prob}%` }}
                    className="h-full bg-zinc-700 transition-all duration-500"
                    title={`İY 0.5 Alt: %${match.prediction.firstHalf.under05Prob}`}
                  />
                </div>
              </div>

              {/* Zamanlama ve Kısa Taktik Notu */}
              <div className="flex items-start gap-1.5 text-[11px] text-amber-200/90 bg-amber-950/20 px-2.5 py-1.5 rounded-lg border border-amber-500/20">
                <Timer className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-amber-300">{match.prediction.firstHalf.goalTimingExpectation}. </span>
                  <span className="text-zinc-300">{match.prediction.firstHalf.summary}</span>
                </div>
              </div>
            </div>
          )}

          {/* Main tip and confidence */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-zinc-900">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Target className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="text-[11px] text-zinc-400 uppercase font-bold tracking-wider">Maç Sonu Tercihi</span>
                <div className="text-sm sm:text-base font-bold text-emerald-400">
                  {match.prediction.mainTip}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${getConfidenceBadge(match.prediction.confidenceLevel)}`}>
                %{match.prediction.confidenceScore} Güven ({match.prediction.confidenceLevel})
              </span>
            </div>
          </div>

          {/* 1-X-2 Probabilities bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-zinc-400 font-medium">
              <span>1: %{match.prediction.probabilities.homeWin}</span>
              <span>X: %{match.prediction.probabilities.draw}</span>
              <span>2: %{match.prediction.probabilities.awayWin}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden flex">
              <div
                style={{ width: `${match.prediction.probabilities.homeWin}%` }}
                className="h-full bg-emerald-500 transition-all duration-500"
                title={`Ev Sahibi: %${match.prediction.probabilities.homeWin}`}
              />
              <div
                style={{ width: `${match.prediction.probabilities.draw}%` }}
                className="h-full bg-amber-500 transition-all duration-500"
                title={`Beraberlik: %${match.prediction.probabilities.draw}`}
              />
              <div
                style={{ width: `${match.prediction.probabilities.awayWin}%` }}
                className="h-full bg-blue-500 transition-all duration-500"
                title={`Deplasman: %${match.prediction.probabilities.awayWin}`}
              />
            </div>
          </div>

          {/* Goal markets & predicted score quick grid */}
          <div className="grid grid-cols-3 gap-2 pt-1 border-t border-zinc-900 text-center text-xs">
            <div className="p-1.5 rounded-lg bg-zinc-900/60 border border-zinc-800/60">
              <span className="text-[10px] text-zinc-500 block">2.5 Gol Piyasası</span>
              <span className="font-semibold text-zinc-200">
                {match.prediction.goalMarket.recommendation} (%{match.prediction.goalMarket.over25 >= 55 ? match.prediction.goalMarket.over25 : match.prediction.goalMarket.under25})
              </span>
            </div>
            <div className="p-1.5 rounded-lg bg-zinc-900/60 border border-zinc-800/60">
              <span className="text-[10px] text-zinc-500 block">Karşılıklı Gol</span>
              <span className="font-semibold text-zinc-200">
                {match.prediction.goalMarket.bttsRecommendation} (%{match.prediction.goalMarket.bttsYes})
              </span>
            </div>
            <div className="p-1.5 rounded-lg bg-zinc-900/60 border border-zinc-800/60">
              <span className="text-[10px] text-zinc-500 block">Skor Tahmini</span>
              <span className="font-semibold text-emerald-400">
                {match.prediction.predictedScore}
              </span>
            </div>
          </div>

          {/* Short summary note */}
          <p className="text-xs text-zinc-400 bg-zinc-900/40 p-2 rounded-lg border border-zinc-800/40">
            <span className="font-semibold text-zinc-300">Analiz: </span>
            {match.prediction.summaryInsight}
          </p>

          {/* Action Row: Chart Toggle, Win Probability & AI Analysis */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-zinc-900">
            <div className="flex flex-wrap items-center gap-2">
              {/* Win Probability Toggle Button */}
              <button
                type="button"
                onClick={() => setShowWinProb(!showWinProb)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer border ${
                  showWinProb
                    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 shadow-sm'
                    : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-700/60 hover:text-white'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
                <span>{showWinProb ? 'Olasılığı Gizle' : 'Win Probability'}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/40 font-bold">
                  AI
                </span>
                {showWinProb ? <ChevronUp className="w-3 h-3 ml-0.5" /> : <ChevronDown className="w-3 h-3 ml-0.5" />}
              </button>

              {/* xG & Pressure Chart Toggle Button */}
              <button
                type="button"
                onClick={() => setShowChart(!showChart)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer border ${
                  showChart
                    ? 'bg-blue-500/20 text-blue-300 border-blue-500/40 shadow-sm'
                    : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-700/60 hover:text-white'
                }`}
              >
                <BarChart2 className="w-3.5 h-3.5 text-blue-400" />
                <span>{showChart ? 'Grafiği Gizle' : 'Baskı & xG'}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-950 text-blue-400 border border-blue-800/40">
                  0-90'
                </span>
                {showChart ? <ChevronUp className="w-3 h-3 ml-0.5" /> : <ChevronDown className="w-3 h-3 ml-0.5" />}
              </button>
            </div>

            {!aiAnalysis && (
              <button
                type="button"
                onClick={handleFetchAiAnalysis}
                disabled={isLoadingAi}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-medium transition cursor-pointer disabled:opacity-50 ml-auto"
              >
                <Sparkles className={`w-3.5 h-3.5 text-purple-400 ${isLoadingAi ? 'animate-spin' : ''}`} />
                <span>{isLoadingAi ? 'AI Analiz...' : 'AI Derin Analiz'}</span>
              </button>
            )}
          </div>

          {/* Gemini AI Win Probability Visual Bar Component */}
          {showWinProb && (
            <WinProbabilityBar match={match} />
          )}

          {/* Recharts Timeline Chart Section */}
          {showChart && (
            <MatchTimelineChart match={match} />
          )}

          {/* AI Analysis section */}
          {aiAnalysis && (
            <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-800/40 text-xs space-y-1.5">
              <div className="flex items-center gap-1.5 text-purple-400 font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Yapay Zeka Derin Analizi</span>
              </div>
              <div className="text-zinc-300 leading-relaxed whitespace-pre-line">
                {aiAnalysis}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
