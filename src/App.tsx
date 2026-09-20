import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Header } from './components/Header.tsx';
import { FilterBar } from './components/FilterBar.tsx';
import { MatchCard } from './components/MatchCard.tsx';
import { Match, StatusFilter } from './types.ts';
import { Activity, Flame, Clock, AlertCircle, RefreshCw, Sparkles, Trophy, Star } from 'lucide-react';
import { notificationService, GoalSignal } from './services/notificationService.ts';

export default function App() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('live');
  const [selectedCompetition, setSelectedCompetition] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [recentSignals, setRecentSignals] = useState<GoalSignal[]>([]);
  const [activeToast, setActiveToast] = useState<GoalSignal | null>(null);

  // User favorites set persisted in localStorage
  const [favorites, setFavorites] = useState<Set<number>>(() => {
    try {
      const saved = localStorage.getItem('user_favorite_matches');
      if (saved) {
        const arr = JSON.parse(saved);
        if (Array.isArray(arr)) {
          return new Set<number>(arr);
        }
      }
    } catch {
      // Ignore
    }
    return new Set<number>();
  });

  const handleToggleFavorite = useCallback((matchId: number) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(matchId)) {
        next.delete(matchId);
      } else {
        next.add(matchId);
      }
      try {
        localStorage.setItem('user_favorite_matches', JSON.stringify(Array.from(next)));
      } catch {
        // Ignore
      }
      return next;
    });
  }, []);

  const [counts, setCounts] = useState({
    total: 0,
    live: 0,
    upcoming: 0,
    finished: 0,
  });

  const fetchMatches = useCallback(async (isBackground = false) => {
    if (!isBackground) setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/matches');
      if (!res.ok) {
        throw new Error(`API hatası: ${res.statusText}`);
      }
      const data = await res.json();
      if (data.success) {
        setMatches(data.matches || []);
        setCounts(data.counts || { total: 0, live: 0, upcoming: 0, finished: 0 });
        setLastUpdated(data.lastUpdated || Date.now());

        // If there are no live matches and filter was on 'live', switch to 'upcoming' so user sees action
        if (data.counts?.live === 0 && statusFilter === 'live') {
          setStatusFilter('upcoming');
        }
      } else {
        throw new Error(data.error || 'Veri çekilemedi');
      }
    } catch (err: any) {
      console.error('Fetch matches error:', err);
      setError('Maç verileri çekilirken bir hata oluştu. Lütfen yenileyiniz.');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  // Initial fetch
  useEffect(() => {
    fetchMatches();
  }, []);

  // Listen to notification service signals
  useEffect(() => {
    const unsubscribe = notificationService.onSignal((signal) => {
      setRecentSignals((prev) => [signal, ...prev.slice(0, 9)]);
      setActiveToast(signal);
    });
    return unsubscribe;
  }, []);

  // Automatically scan matches for critical goal and first-half signals
  useEffect(() => {
    if (matches.length > 0) {
      notificationService.evaluateMatches(matches, false);
    }
  }, [matches]);

  // Auto-dismiss floating toast after 8 seconds
  useEffect(() => {
    if (activeToast) {
      const timer = setTimeout(() => {
        setActiveToast(null);
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [activeToast]);

  const handleSelectMatch = useCallback((matchId: number) => {
    const target = matches.find((m) => m.id === matchId);
    if (target) {
      if (target.status === 'IN_PLAY' || target.status === 'PAUSED') {
        setStatusFilter('live');
      } else if (target.prediction?.firstHalf?.over05Prob && target.prediction.firstHalf.over05Prob >= 72) {
        setStatusFilter('first_half_hot');
      } else {
        setStatusFilter('all');
      }
      setSelectedCompetition('ALL');
      setSearchQuery('');
      setTimeout(() => {
        const el = document.getElementById(`match-${matchId}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 200);
    }
  }, [matches]);

  // Auto-refresh interval (every 45 seconds)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchMatches(true);
    }, 45000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchMatches]);

  // Unique competitions from fetched matches
  const competitions = useMemo(() => {
    const map = new Map<string, string>();
    matches.forEach((m) => {
      if (m.competition?.code && m.competition?.name) {
        map.set(m.competition.code, m.competition.name);
      }
    });
    return Array.from(map.entries()).map(([code, name]) => ({ code, name }));
  }, [matches]);

  // Filtered matches
  const filteredMatches = useMemo(() => {
    return matches.filter((m) => {
      // Status filter
      if (statusFilter === 'favorites') {
        if (!favorites.has(m.id)) return false;
      } else if (statusFilter === 'first_half_hot') {
        if (!m.prediction?.firstHalf || m.prediction.firstHalf.over05Prob < 72) return false;
      } else if (statusFilter === 'live') {
        if (m.status !== 'IN_PLAY' && m.status !== 'PAUSED') return false;
      } else if (statusFilter === 'upcoming') {
        if (m.status !== 'TIMED' && m.status !== 'SCHEDULED') return false;
      } else if (statusFilter === 'finished') {
        if (m.status !== 'FINISHED') return false;
      }

      // Competition filter
      if (selectedCompetition !== 'ALL' && m.competition?.code !== selectedCompetition) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const home = m.homeTeam?.name?.toLowerCase() || '';
        const away = m.awayTeam?.name?.toLowerCase() || '';
        const comp = m.competition?.name?.toLowerCase() || '';
        if (!home.includes(q) && !away.includes(q) && !comp.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [matches, statusFilter, selectedCompetition, searchQuery, favorites]);

  // Top First-Half Goal Predictions (Kullanıcının öncelikli odak isteği)
  const topFirstHalfPicks = useMemo(() => {
    return [...matches]
      .filter((m) => m.status !== 'FINISHED' && m.prediction?.firstHalf)
      .sort((a, b) => (b.prediction.firstHalf.over05Prob || 0) - (a.prediction.firstHalf.over05Prob || 0))
      .slice(0, 3);
  }, [matches]);

  // Count of high-potential first half goal matches
  const firstHalfHotCount = useMemo(() => {
    return matches.filter((m) => (m.prediction?.firstHalf?.over05Prob || 0) >= 72).length;
  }, [matches]);

  // Count of favorited matches
  const favoritesCount = useMemo(() => {
    return matches.filter((m) => favorites.has(m.id)).length;
  }, [matches, favorites]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-black">
      {/* Top Header */}
      <Header
        liveCount={counts.live}
        upcomingCount={counts.upcoming}
        totalCount={counts.total}
        lastUpdated={lastUpdated}
        isLoading={isLoading}
        onRefresh={() => fetchMatches(false)}
        autoRefresh={autoRefresh}
        setAutoRefresh={setAutoRefresh}
        recentSignals={recentSignals}
        activeToast={activeToast}
        onCloseToast={() => setActiveToast(null)}
        onSelectMatch={handleSelectMatch}
      />

      {/* Main Container */}
      <main className="max-w-6xl mx-auto w-full px-4 py-6 flex-1 space-y-6">
        {/* Top First-Half Goal Predictions Showcase */}
        {topFirstHalfPicks.length > 0 && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/35 via-zinc-900/90 to-zinc-900/50 border border-amber-500/30 shadow-md">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Flame className="w-4 h-4 animate-pulse" />
                </div>
                <div>
                  <h2 className="text-xs sm:text-sm font-extrabold tracking-tight text-white flex items-center gap-2">
                    <span>İlk Yarı Gol Tahminleri (Özel Odak)</span>
                    <span className="text-[10px] px-2 py-0.2 rounded-full bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                      İY 0.5 & 1.5 Üst
                    </span>
                  </h2>
                  <p className="text-[11px] text-zinc-400">
                    İlk 45 dakikada gol beklentisi en yüksek karşılaşmalar ve taktiksel erken baskı analizi
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setStatusFilter('first_half_hot')}
                className="text-xs font-semibold text-amber-400 hover:text-amber-300 transition cursor-pointer px-2.5 py-1 rounded-lg bg-amber-950/50 border border-amber-800/40"
              >
                Tüm İY Fırsatlarını Gör ({firstHalfHotCount}) →
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {topFirstHalfPicks.map((pick) => (
                <div
                  key={`fh-pick-${pick.id}`}
                  className="p-3 rounded-xl bg-zinc-900/90 border border-amber-500/20 hover:border-amber-500/40 transition flex flex-col justify-between gap-2"
                >
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span className="truncate font-medium">{pick.competition.name}</span>
                    <span className="font-bold text-amber-300 text-[11px] px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/30">
                      %{pick.prediction.firstHalf.over05Prob} İhtimal
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-zinc-100 truncate">
                    {pick.homeTeam.shortName} vs {pick.awayTeam.shortName}
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-zinc-800/70 text-xs">
                    <div>
                      <span className="text-zinc-400 text-[10px] block">Önerilen İY</span>
                      <span className="font-bold text-amber-300">{pick.prediction.firstHalf.recommendation}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-zinc-400 text-[10px] block">İY Skor</span>
                      <span className="font-mono font-bold text-white">{pick.prediction.firstHalf.predictedHalfScore}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filter Bar */}
        <FilterBar
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          selectedCompetition={selectedCompetition}
          setSelectedCompetition={setSelectedCompetition}
          competitions={competitions}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          counts={{
            ...counts,
            firstHalfHot: firstHalfHotCount,
            favorites: favoritesCount,
          }}
        />

        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => fetchMatches(false)}
              className="px-2.5 py-1 rounded bg-red-900/60 hover:bg-red-800/80 text-white font-medium text-xs transition cursor-pointer"
            >
              Tekrar Dene
            </button>
          </div>
        )}

        {/* Matches Section */}
        {isLoading && matches.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
            <p className="text-sm font-medium text-zinc-300">Canlı ve güncel maç verileri çekiliyor...</p>
            <p className="text-xs text-zinc-500">football-data.org API üzerinden tahminler hesaplanıyor</p>
          </div>
        ) : filteredMatches.length === 0 ? (
          <div className="py-16 text-center space-y-3 p-8 rounded-2xl bg-zinc-900/30 border border-zinc-800/60">
            {statusFilter === 'favorites' ? (
              <>
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto text-amber-400">
                  <Star className="w-6 h-6 fill-amber-400/20 text-amber-400" />
                </div>
                <h3 className="text-sm font-bold text-zinc-200">Henüz favori maç eklemediniz</h3>
                <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
                  İncelediğiniz maç kartlarının sağ üst köşesindeki yıldız (<Star className="w-3 h-3 inline text-amber-400 fill-amber-400 mx-0.5 -mt-0.5" />) simgesine tıklayarak favorilerinize ekleyebilir, skor ve tahminleri buradan toplu olarak izleyebilirsiniz.
                </p>
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition cursor-pointer shadow"
                >
                  <span>Tüm Maçları Keşfet</span>
                </button>
              </>
            ) : (
              <>
                <Trophy className="w-10 h-10 text-zinc-600 mx-auto" />
                <h3 className="text-sm font-semibold text-zinc-300">Bu filtrelere uygun maç bulunamadı</h3>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                  {statusFilter === 'live'
                    ? 'Şu anda canlı oynanan maç bulunmuyor. Bugün oynanacak yaklaşan maçları görüntüleyebilirsiniz.'
                    : 'Arama kriterlerinizi değiştirebilir veya diğer ligleri seçebilirsiniz.'}
                </p>
                {statusFilter === 'live' && (
                  <button
                    type="button"
                    onClick={() => setStatusFilter('upcoming')}
                    className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-semibold transition cursor-pointer"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Oynanacak Maçları Göster ({counts.upcoming})</span>
                  </button>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>
                Toplam <strong className="text-zinc-200">{filteredMatches.length}</strong> maç listeleniyor
              </span>
              <span className="text-zinc-500 text-[11px]">
                {statusFilter === 'favorites'
                  ? '⭐ Favorilerimdeki maçlar'
                  : statusFilter === 'live'
                  ? '🔴 Anlık canlı maçlar'
                  : statusFilter === 'upcoming'
                  ? '⏳ Bugün oynanacak maçlar'
                  : 'Tüm maçlar'}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {filteredMatches.map((match) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  isFavorite={favorites.has(match.id)}
                  onToggleFavorite={handleToggleFavorite}
                />
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950 py-5 text-center text-xs text-zinc-500 mt-auto">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>football-data.org v4 API & Gemini AI Destekli Maç Tahmin Sistemi</span>
          <span className="text-[11px] text-zinc-600">Veriler resmi fikstür ve istatistiki modellemelerle anlık güncellenir.</span>
        </div>
      </footer>
    </div>
  );
}
