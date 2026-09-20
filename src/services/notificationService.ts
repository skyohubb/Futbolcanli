import { Match } from '../types.ts';

export interface GoalSignal {
  id: string;
  matchId: number;
  type: 'FIRST_HALF_GOAL' | 'HIGH_XG_PRESSURE' | 'LIVE_PRESSURE_SURGE' | 'FAVORITE_GOAL';
  title: string;
  message: string;
  homeTeam: string;
  awayTeam: string;
  probability: number;
  timestamp: number;
  competition: string;
  score?: string;
}

class NotificationService {
  private notifiedSignalIds: Set<string> = new Set();
  private audioContext: AudioContext | null = null;
  private signalListeners: Array<(signal: GoalSignal) => void> = [];

  constructor() {
    // Load previously notified keys from session to avoid repeated spam on reloads
    try {
      const saved = sessionStorage.getItem('notified_goal_signals');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          this.notifiedSignalIds = new Set(parsed);
        }
      }
    } catch {
      // Ignore sessionStorage errors
    }
  }

  // Subscribe to in-app alerts
  public onSignal(callback: (signal: GoalSignal) => void): () => void {
    this.signalListeners.push(callback);
    return () => {
      this.signalListeners = this.signalListeners.filter((cb) => cb !== callback);
    };
  }

  // Check if browser notifications are supported
  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  // Current permission state
  public getPermission(): NotificationPermission {
    if (!this.isSupported()) return 'denied';
    return Notification.permission;
  }

  // Request permission from the user
  public async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) return 'denied';
    try {
      const permission = await Notification.requestPermission();
      return permission;
    } catch (e) {
      console.warn('Notification permission error:', e);
      return 'denied';
    }
  }

  // Play a crisp football chime audio using synthesized Web Audio API
  public playAlertSound(): void {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      if (!this.audioContext) {
        this.audioContext = new AudioCtx();
      }

      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }

      const now = this.audioContext.currentTime;

      // Note 1 (Bright initial ping)
      const osc1 = this.audioContext.createOscillator();
      const gain1 = this.audioContext.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now); // D5
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5

      gain1.gain.setValueAtTime(0.18, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc1.connect(gain1);
      gain1.connect(this.audioContext.destination);

      osc1.start(now);
      osc1.stop(now + 0.35);

      // Note 2 (Affirming high chime for alert recognition)
      const osc2 = this.audioContext.createOscillator();
      const gain2 = this.audioContext.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(1046.5, now + 0.14); // C6

      gain2.gain.setValueAtTime(0.14, now + 0.14);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

      osc2.connect(gain2);
      gain2.connect(this.audioContext.destination);

      osc2.start(now + 0.14);
      osc2.stop(now + 0.55);
    } catch {
      // Audio playback fails gracefully if user hasn't interacted
    }
  }

  // Dispatch a notification
  public dispatchSignal(signal: GoalSignal, playSound = true): void {
    if (this.notifiedSignalIds.has(signal.id)) return;

    this.notifiedSignalIds.add(signal.id);
    try {
      sessionStorage.setItem('notified_goal_signals', JSON.stringify(Array.from(this.notifiedSignalIds)));
    } catch {
      // Ignore
    }

    if (playSound) {
      this.playAlertSound();
    }

    // 1. In-app listeners
    this.signalListeners.forEach((listener) => listener(signal));

    // 2. Native Browser Notification API
    if (this.isSupported() && Notification.permission === 'granted') {
      try {
        const notif = new Notification(signal.title, {
          body: signal.message,
          icon: '/favicon.ico',
          tag: signal.id,
        });

        notif.onclick = () => {
          window.focus();
          const el = document.getElementById(`match-${signal.matchId}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          notif.close();
        };
      } catch (err) {
        console.warn('Native notification failed:', err);
      }
    }
  }

  // Favori gol takibi için onceki skor map'i (session)
  private previousFavScores: Map<number, string> = new Map();

  // Favori maçlarda skor değişimini izle ve anlık gol bildirimi at
  public evaluateFavoriteGoals(matches: Match[], favorites: Set<number>, enableSound = true): GoalSignal[] {
    const newSignals: GoalSignal[] = [];
    matches.forEach((match) => {
      if (!favorites.has(match.id)) return;
      const cur = `${match.score?.fullTime?.home ?? 0}-${match.score?.fullTime?.away ?? 0}`;
      const prev = this.previousFavScores.get(match.id);
      // ilk kez görüldü -> sadece kaydet
      if (prev === undefined) {
        this.previousFavScores.set(match.id, cur);
        return;
      }
      if (prev !== cur) {
        const [ph, pa] = prev.split('-').map((n) => parseInt(n, 10));
        const [ch, ca] = cur.split('-').map((n) => parseInt(n, 10));
        const home = match.homeTeam.shortName || match.homeTeam.name;
        const away = match.awayTeam.shortName || match.awayTeam.name;
        let scorer = '';
        if (ch > ph) scorer = home;
        else if (ca > pa) scorer = away;
        // sadece gol artışı bildirimlendir
        if (scorer) {
          const signalKey = `fav_goal_${match.id}_${cur}_${Date.now()}`; // her gol benzersiz
          // aynı skor tekrar bildirimi engelle (kısa sürede duplicate)
          const dedupKey = `fav_goal_${match.id}_${cur}`;
          if (!this.notifiedSignalIds.has(dedupKey)) {
            const signal: GoalSignal = {
              id: signalKey,
              matchId: match.id,
              type: 'FAVORITE_GOAL',
              title: `⚽ GOL! ${home} ${ch} - ${ca} ${away}`,
              message: `Favorindeki maçta gol! ${scorer} gol attı. Skor: ${ch} - ${ca} (${match.competition.name})`,
              homeTeam: home,
              awayTeam: away,
              probability: 100,
              timestamp: Date.now(),
              competition: match.competition.name,
              score: cur,
            };
            this.notifiedSignalIds.add(dedupKey);
            try { sessionStorage.setItem('notified_goal_signals', JSON.stringify(Array.from(this.notifiedSignalIds))); } catch {}
            this.dispatchSignal(signal, enableSound);
            newSignals.push(signal);
          }
        }
        this.previousFavScores.set(match.id, cur);
      }
    });
    // favoriden çıkan maçları temizle
    for (const id of Array.from(this.previousFavScores.keys())) {
      if (!favorites.has(id)) this.previousFavScores.delete(id);
    }
    return newSignals;
  }

  // Scan matches for high-probability signals
  public evaluateMatches(matches: Match[], enableSound = true): GoalSignal[] {
    const newSignals: GoalSignal[] = [];

    matches.forEach((match) => {
      const isLive = match.status === 'IN_PLAY' || match.status === 'PAUSED';
      const home = match.homeTeam.shortName || match.homeTeam.name;
      const away = match.awayTeam.shortName || match.awayTeam.name;
      const fh = match.prediction?.firstHalf;

      // 1. İlk Yarı Gol Sinyali (İY 0.5 Üst >= %75)
      if (fh && fh.over05Prob >= 75) {
        const signalKey = `fh_signal_${match.id}_${match.status}`;
        if (!this.notifiedSignalIds.has(signalKey)) {
          const signal: GoalSignal = {
            id: signalKey,
            matchId: match.id,
            type: 'FIRST_HALF_GOAL',
            title: `🔥 İLK YARI GOL SİNYALİ: ${home} - ${away}`,
            message: `İY 0.5 Üst %${fh.over05Prob} ihtimal! Beklenen İY Skor: ${fh.predictedHalfScore}. ${fh.goalTimingExpectation}.`,
            homeTeam: home,
            awayTeam: away,
            probability: fh.over05Prob,
            timestamp: Date.now(),
            competition: match.competition.name,
            score: isLive ? `${match.score?.fullTime?.home ?? 0} - ${match.score?.fullTime?.away ?? 0}` : undefined,
          };
          this.dispatchSignal(signal, enableSound);
          newSignals.push(signal);
        }
      }

      // 2. Canlı Yüksek Gol Beklentisi / Baskı Sinyali
      if (isLive && match.prediction?.confidenceScore && match.prediction.confidenceScore >= 80) {
        const liveKey = `live_surge_${match.id}`;
        if (!this.notifiedSignalIds.has(liveKey)) {
          const signal: GoalSignal = {
            id: liveKey,
            matchId: match.id,
            type: 'HIGH_XG_PRESSURE',
            title: `⚡ CANLI GOL BASKISI: ${home} - ${away}`,
            message: `Canlı maçta yüksek gol baskısı! Tercih: ${match.prediction.mainTip} (%${match.prediction.confidenceScore} Güven).`,
            homeTeam: home,
            awayTeam: away,
            probability: match.prediction.confidenceScore,
            timestamp: Date.now(),
            competition: match.competition.name,
            score: `${match.score?.fullTime?.home ?? 0} - ${match.score?.fullTime?.away ?? 0}`,
          };
          this.dispatchSignal(signal, enableSound);
          newSignals.push(signal);
        }
      }
    });

    return newSignals;
  }

  // Trigger test notification
  public sendTestSignal(): GoalSignal {
    const testSignal: GoalSignal = {
      id: `test_signal_${Date.now()}`,
      matchId: 999999,
      type: 'FIRST_HALF_GOAL',
      title: '🔥 TEST İLK YARI GOL SİNYALİ',
      message: 'Tarayıcı bildirim sistemi ve sesli uyarı başarıyla çalışıyor! Canlı maçlardaki İY fırsatları anında buraya düşecek.',
      homeTeam: 'Arsenal',
      awayTeam: 'Chelsea',
      probability: 88,
      timestamp: Date.now(),
      competition: 'Premier League',
      score: '0 - 0',
    };
    this.dispatchSignal(testSignal, true);
    return testSignal;
  }
}

export const notificationService = new NotificationService();
