import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
      const { apiUrl } = await import('./services/api.ts');
      // 1. Birincil: canli API
      let data: any = null;
      let lastErr: any = null;
      try {
        const res = await fetch(apiUrl('/api/matches'));
        if (!res.ok) throw new Error(`API hatası: ${res.status} ${res.statusText}`);
        data = await res.json();
        if (!data.success) throw new Error(data.error || 'Veri çekilemedi');
      } catch (e) {
        lastErr = e;
        // 2. Fallback: gunluk persist
        try {
          const res2 = await fetch(apiUrl('/api/daily-predictions'));
          if (res2.ok) {
            const d2 = await res2.json();
            if (d2.success && d2.matches) {
              data = {
                success: true,
                matches: d2.matches,
                counts: {
                  total: d2.count ?? d2.matches.length,
                  live: d2.matches.filter((m: Match) => m.status === 'IN_PLAY' || m.status === 'PAUSED').length,
                  upcoming: d2.matches.filter((m: Match) => m.status === 'TIMED' || m.status === 'SCHEDULED').length,
                  finished: d2.matches.filter((m: Match) => m.status === 'FINISHED').length,
                },
                lastUpdated: d2.timestamp || Date.now(),
              };
            }
          }
        } catch {}
        // 3. Son fallback: gomulu offline veri (APK / sunucusuz calisma)
        if (!data?.success) {
          try {
            const res3 = await fetch(apiUrl('/data/latest.json'));
            if (res3.ok) {
              const d3 = await res3.json();
              if (d3.matches) {
                data = {
                  success: true,
                  matches: d3.matches,
                  counts: {
                    total: d3.count ?? d3.matches.length,
                    live: d3.matches.filter((m: Match) => m.status === 'IN_PLAY' || m.status === 'PAUSED').length,
                    upcoming: d3.matches.filter((m: Match) => m.status === 'TIMED' || m.status === 'SCHEDULED').length,
                    finished: d3.matches.filter((m: Match) => m.status === 'FINISHED').length,
                  },
                  lastUpdated: d3.timestamp || Date.now(),
                };
              }
            }
          } catch {}
        }
      }
      if (data?.success) {
        setMatches(data.matches || []);
        setCounts(data.counts || { total: 0, live: 0, upcoming: 0, finished: 0 });
        setLastUpdated(data.lastUpdated || Date.now());

        // If there are no live matches and filter was on 'live', switch to 'upcoming' so user sees action
        if (data.counts?.live === 0 && statusFilter === 'live') {
          setStatusFilter('upcoming');
        }
      } else {
        throw lastErr || new Error('Veri çekilemedi');
      }
    } catch (err: any) {
      console.error('Fetch matches error:', err);
      const apiBase = (await import('./services/api.ts')).API_BASE;
      setError(`Maç verileri çekilirken bir hata oluştu (${err?.message || 'baglanti hatasi'}). Sunucu: ${apiBase}/api/matches`);
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

  // Automatically scan matches for critical goal and first-half signals + favori gol + maç başlama
  useEffect(() => {
    if (matches.length > 0) {
      notificationService.evaluateMatches(matches, false);
      notificationService.evaluateMatchStarts(matches, favorites);
      if (favorites.size > 0) {
        notificationService.evaluateFavoriteGoals(matches, favorites, true);
      }
    }
  }, [matches, favorites]);

  // Auto-dismiss floating toast after 12 seconds (yarım görünme düzeltildi)
  useEffect(() => {
    if (activeToast) {
      const timer = setTimeout(() => {
        setActiveToast(null);
      }, 12000);
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

  // Auto-refresh: canlı maç varsa 15sn (gerçek canlı hissi), yoksa 45sn
  const refreshIntervalMs = useMemo(() => {
    const hasLive = matches.some((m) => m.status === 'IN_PLAY' || m.status === 'PAUSED');
    return hasLive ? 15000 : 45000;
  }, [matches]);
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchMatches(true);
    }, refreshIntervalMs);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchMatches, refreshIntervalMs]);

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

  // Gruplu görünüm için (çorba olmasın): Tümü seçiliyse canlı / oynanacak / biten ayrık listeler
  const grouped = useMemo(() => {
    if (statusFilter !== 'all') return null;
    const base = matches.filter((m) => {
      if (selectedCompetition !== 'ALL' && m.competition?.code !== selectedCompetition) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const home = m.homeTeam?.name?.toLowerCase() || '';
        const away = m.awayTeam?.name?.toLowerCase() || '';
        const comp = m.competition?.name?.toLowerCase() || '';
        if (!home.includes(q) && !away.includes(q) && !comp.includes(q)) return false;
      }
      return true;
    });
    const live = base.filter((m) => m.status === 'IN_PLAY' || m.status === 'PAUSED');
    const upcoming = base.filter((m) => m.status === 'TIMED' || m.status === 'SCHEDULED');
    const finished = base.filter((m) => m.status === 'FINISHED');
    return { live, upcoming, finished };
  }, [matches, statusFilter, selectedCompetition, searchQuery]);

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
            <p className="text-xs text-zinc-500">Anlık veriler üzerinden tahminler hesaplanıyor</p>
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
        ) : statusFilter === 'all' && grouped ? (
          <div className="space-y-8">
            {/* Canlı - en üstte, otomatik yenilenir 25sn */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                  Canlı Maçlar
                  <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 text-[11px] border border-red-500/30">{grouped.live.length}</span>
                </h3>
                <span className="text-[11px] text-zinc-500">Her 25sn otomatik yenilenir {autoRefresh ? '●' : '○'}</span>
              </div>
              {grouped.live.length === 0 ? (
                <div className="p-4 rounded-xl bg-zinc-900/30 border border-zinc-800 text-xs text-zinc-500 text-center">Şu an canlı maç yok — favori işaretlediğinde golde anında bildirim alırsın.</div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {grouped.live.map((m) => (
                    <MatchCard key={m.id} match={m} isFavorite={favorites.has(m.id)} onToggleFavorite={handleToggleFavorite} />
                  ))}
                </div>
              )}
            </section>

            {/* Oynanacak */}
            <section className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                <Clock className="w-4 h-4 text-amber-400" /> Başlayacak Maçlar
                <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 text-[11px] border border-zinc-700">{grouped.upcoming.length}</span>
              </h3>
              {grouped.upcoming.length === 0 ? (
                <div className="p-4 rounded-xl bg-zinc-900/30 border border-zinc-800 text-xs text-zinc-500 text-center">Başlayacak maç bulunamadı.</div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {grouped.upcoming.map((m) => (
                    <MatchCard key={m.id} match={m} isFavorite={favorites.has(m.id)} onToggleFavorite={handleToggleFavorite} />
                  ))}
                </div>
              )}
            </section>

            {/* Bitenler */}
            <section className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-bold text-zinc-300">
                <Trophy className="w-4 h-4 text-zinc-500" /> Biten Maçlar
                <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 text-[11px] border border-zinc-700">{grouped.finished.length}</span>
              </h3>
              {grouped.finished.length === 0 ? (
                <div className="p-4 rounded-xl bg-zinc-900/30 border border-zinc-800 text-xs text-zinc-500 text-center">Henüz biten maç yok.</div>
              ) : (
                <div className="grid grid-cols-1 gap-4 opacity-90">
                  {grouped.finished.map((m) => (
                    <MatchCard key={m.id} match={m} isFavorite={favorites.has(m.id)} onToggleFavorite={handleToggleFavorite} />
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>
                Toplam <strong className="text-zinc-200">{filteredMatches.length}</strong> maç listeleniyor
                {autoRefresh && <span className="ml-2 text-[11px] text-emerald-400">● {grouped ? '' : refreshIntervalMs / 1000 + 'sn oto-yenile'}</span>}
              </span>
              <span className="text-zinc-500 text-[11px]">
                {statusFilter === 'favorites'
                  ? '⭐ Favorilerimdeki maçlar (gol olunca bildirim)'
                  : statusFilter === 'live'
                  ? '🔴 Anlık canlı maçlar'
                  : statusFilter === 'upcoming'
                  ? '⏳ Bugün oynanacak maçlar'
                  : statusFilter === 'first_half_hot'
                  ? '🔥 İY 0.5 Üst fırsatları'
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
          <span>Canlı Maç Tahminleri</span>
          <span className="text-[11px] text-zinc-600">Veriler anlık güncellenir.</span>
        </div>
      </footer>
    </div>
  );
}
