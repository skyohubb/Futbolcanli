export interface EloRating {
  rating: number;
  rank?: number;
  countryCode?: string;
  source: 'eloratings.net' | 'calculated';
}

export interface Team {
  id: number;
  name: string;
  shortName: string;
  tla: string;
  crest: string;
  elo?: EloRating;
}

export interface Competition {
  id: number;
  name: string;
  code: string;
  type: string;
  emblem: string;
}

export interface Area {
  id: number;
  name: string;
  code: string;
  flag: string;
}

export interface ScoreTime {
  home: number | null;
  away: number | null;
}

export interface Score {
  winner: 'HOME_TEAM' | 'AWAY_TEAM' | 'DRAW' | null;
  duration: string;
  fullTime: ScoreTime;
  halfTime?: ScoreTime;
}

export interface FirstHalfGoalPrediction {
  over05Prob: number; // İY 0.5 Üst Olasılığı % (e.g. 80%)
  over15Prob: number; // İY 1.5 Üst Olasılığı % (e.g. 42%)
  under05Prob: number; // İY 0.5 Alt Olasılığı %
  recommendation: string; // "İY 0.5 Üst" | "İY 1.5 Üst" | "İY 0.5 Alt"
  confidenceScore: number;
  confidenceLevel: 'Çok Yüksek' | 'Yüksek' | 'Orta' | 'Düşük';
  predictedHalfScore: string; // "1 - 0", "0 - 0", "1 - 1"
  goalTimingExpectation: string; // "1-30. dk arası gol bekleniyor"
  summary: string;
}

export interface MatchPrediction {
  mainTip: string; // e.g. "MS 1 (Ev Sahibi)"
  tipType: '1' | 'X' | '2' | '1X' | 'X2' | 'OVER_25' | 'UNDER_25' | 'BTTS_YES';
  confidenceScore: number; // 0 - 100
  confidenceLevel: 'Yüksek' | 'Orta' | 'Dengeli';
  firstHalf: FirstHalfGoalPrediction; // ÖZEL İLK YARI GOL TAHMİNİ
  probabilities: {
    homeWin: number;
    draw: number;
    awayWin: number;
  };
  goalMarket: {
    over25: number;
    under25: number;
    recommendation: string; // "2.5 Üst" | "2.5 Alt"
    bttsYes: number; // Karşılıklı Gol Var %
    bttsNo: number;
    bttsRecommendation: string; // "KG Var" | "KG Yok"
  };
  predictedScore: string; // "2 - 1"
  summaryInsight: string; // Kısa analiz notu
  aiInsight?: string; // Optional Gemini analysis
  liveMomentum?: string; // e.g. "Ev sahibi baskıyı artırdı, gol yakın"
  winProbability?: WinProbabilityData;
}

export interface WinProbabilityData {
  homeWinProb: number; // 0 - 100
  drawProb: number; // 0 - 100
  awayWinProb: number; // 0 - 100
  momentum: string; // e.g. "Ev Sahibi Yoğun Baskıda"
  keyFactors: string[];
  summary: string;
  source: 'gemini_ai' | 'groq_ai' | 'deepseek_ai' | 'openrouter_ai' | 'statistical_model';
  updatedAt?: number;
}

export interface Match {
  id: number;
  utcDate: string;
  status: 'IN_PLAY' | 'PAUSED' | 'TIMED' | 'SCHEDULED' | 'FINISHED' | 'POSTPONED' | 'CANCELLED' | 'SUSPENDED';
  minute?: number;
  matchday?: number;
  stage?: string;
  competition: Competition;
  area: Area;
  homeTeam: Team;
  awayTeam: Team;
  score: Score;
  prediction: MatchPrediction;
}

export type StatusFilter = 'all' | 'first_half_hot' | 'live' | 'upcoming' | 'finished' | 'favorites';
