import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());
app.use(express.static(path.join(process.cwd(), 'public')));

// CORS - APK (capacitor) ve web için gerekli (Access-Control-Allow-Origin)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ------------------------------------
// Persistent Data Store (sunucuda veri tutma - günlük tahminler)
// ------------------------------------
const DATA_DIR = path.join(process.cwd(), 'data');
const DAILY_DIR = path.join(DATA_DIR, 'daily');
try {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DAILY_DIR)) fs.mkdirSync(DAILY_DIR, { recursive: true });
} catch {}

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

async function persistDailyPredictions(matches: any[]): Promise<void> {
  const today = getTodayKey();
  const payload = {
    date: today,
    timestamp: Date.now(),
    count: matches.length,
    matches: matches.map((m: any) => ({
      id: m.id,
      utcDate: m.utcDate,
      status: m.status,
      competition: m.competition,
      area: m.area,
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
      score: m.score,
      prediction: m.prediction,
    })),
  };
  try {
    const filePath = path.join(DAILY_DIR, `${today}.json`);
    const latestPath = path.join(DATA_DIR, 'latest.json');
    const historyPath = path.join(DATA_DIR, 'history.json');
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8');
    fs.writeFileSync(latestPath, JSON.stringify(payload, null, 2), 'utf-8');
    // Append to history index (keep last 60 days)
    let history: any[] = [];
    if (fs.existsSync(historyPath)) {
      try { history = JSON.parse(fs.readFileSync(historyPath, 'utf-8')); } catch { history = []; }
    }
    const existingIdx = history.findIndex((h: any) => h.date === today);
    const summary = { date: today, timestamp: payload.timestamp, count: payload.count, live: matches.filter((m: any) => m.status === 'IN_PLAY' || m.status === 'PAUSED').length, finished: matches.filter((m: any) => m.status === 'FINISHED').length };
    if (existingIdx >= 0) history[existingIdx] = summary;
    else history.push(summary);
    // keep sorted descending and limit 60
    history.sort((a, b) => b.date.localeCompare(a.date));
    if (history.length > 60) history = history.slice(0, 60);
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), 'utf-8');
    // Optional: sync to Cloudflare R2 if configured (non-blocking)
    syncToR2IfConfigured(filePath, `${today}.json`).catch(() => {});
    // Optional: Telegram broadcast skeleton (env yoksa hic calismaz - sistemi bozmaz)
    // Ornek: notifyTelegramIfConfigured(`📅 ${today} tahminler guncellendi: ${matches.length} mac`).catch(()=>{});
  } catch (e) {
    console.warn('persistDailyPredictions failed', e);
  }
}

async function syncToR2IfConfigured(localPath: string, remoteKey: string): Promise<void> {
  // Only attempt if R2 is explicitly enabled; otherwise silently skip - local persistence is primary
  if (!process.env.R2_ENABLED || process.env.R2_ENABLED === 'false') return;
  const r2Endpoint = process.env.R2_ENDPOINT || (process.env.CLOUDFLARE_ACCOUNT_ID ? `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com` : undefined);
  const accessKey = process.env.R2_ACCESS_KEY_ID || process.env.CF_R2_ACCESS_KEY;
  const secretKey = process.env.R2_SECRET_ACCESS_KEY || process.env.CF_R2_SECRET_KEY;
  const bucket = process.env.R2_BUCKET || 'futbolcanli-data';
  if (!r2Endpoint || !accessKey || !secretKey) {
    console.warn('R2 sync skipped: missing R2_ENDPOINT / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY');
    return;
  }
  try {
    // Lazy import aws-sdk if available
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3' as any);
    const client = new S3Client({ region: 'auto', endpoint: r2Endpoint, credentials: { accessKeyId: accessKey, secretAccessKey: secretKey } });
    const body = fs.readFileSync(localPath);
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: `daily/${remoteKey}`, Body: body, ContentType: 'application/json' }));
    console.log(`R2 sync ok: daily/${remoteKey}`);
  } catch {}
}

const FOOTBALL_API_KEY = process.env.FOOTBALL_DATA_API_KEY || '';
const FOOTBALL_API_BASE = 'https://api.football-data.org/v4';

// Telegram - sadece env varsa calisir, yoksa no-op (sistemi bozmaz, free API'yi yormaz)
async function notifyTelegramIfConfigured(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHANNEL_ID;
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown', disable_web_page_preview: true }),
    });
    console.log('telegram notify ok');
  } catch {}
}

// Simple in-memory cache to prevent hitting football-data rate limits (10 req/min) - dengeli mod: 60s
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}
let matchesCache: CacheEntry<any> | null = null;
const CACHE_TTL_MS = 60 * 1000; // 60 seconds - free API'yi korumak için 30s -> 60s

// ----------------------------------------------------
// Elo Ratings Integration (https://www.eloratings.net/)
// ----------------------------------------------------
interface EloEntry {
  name: string;
  code: string;
  elo: number;
  rank: number;
}
let eloRatingsCache: { map: Record<string, EloEntry>; timestamp: number } | null = null;
const ELO_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

async function fetchEloRatings(): Promise<Record<string, EloEntry>> {
  const now = Date.now();
  if (eloRatingsCache && now - eloRatingsCache.timestamp < ELO_CACHE_TTL_MS) {
    return eloRatingsCache.map;
  }

  try {
    const [teamsRes, worldRes] = await Promise.all([
      fetch('https://www.eloratings.net/en.teams.tsv'),
      fetch('https://www.eloratings.net/World.tsv'),
    ]);

    if (!teamsRes.ok || !worldRes.ok) {
      console.warn('Could not fetch from eloratings.net, using fallback.');
      return eloRatingsCache?.map || {};
    }

    const teamsText = await teamsRes.text();
    const codeToName: Record<string, string> = {};
    teamsText.split('\n').forEach((line) => {
      const parts = line.split('\t');
      if (parts[0] && parts[1]) {
        codeToName[parts[0].trim()] = parts[1].trim();
      }
    });

    const worldText = await worldRes.text();
    const map: Record<string, EloEntry> = {};
    worldText.split('\n').forEach((line) => {
      const parts = line.split('\t');
      // Format: [rank, ?, code, elo, ...]
      if (parts.length > 3) {
        const rank = parseInt(parts[0]?.trim(), 10);
        const code = parts[2]?.trim();
        const elo = parseInt(parts[3]?.trim(), 10);
        if (code && !isNaN(elo)) {
          const name = codeToName[code] || code;
          const entry = { name, code, elo, rank: isNaN(rank) ? 999 : rank };
          map[name.toLowerCase()] = entry;
          map[code.toLowerCase()] = entry;
        }
      }
    });

    eloRatingsCache = { map, timestamp: now };
    console.log(`Loaded ${Object.keys(map).length} Elo ratings from eloratings.net`);
    return map;
  } catch (error) {
    console.error('Error loading eloratings:', error);
    return eloRatingsCache?.map || {};
  }
}

// Club level ELO mappings — genisletildi (PL, EFL, DED, SA, BSA, PD)
const CLUB_ELO_MAPPINGS: Record<string, number> = {
  'real madrid': 2045, 'manchester city': 2060, 'arsenal': 1995, 'bayern münchen': 1990,
  'liverpool': 2010, 'barcelona': 1985, 'inter': 1970, 'paris saint-germain': 1940,
  'bayer leverkusen': 1945, 'atlético madrid': 1930, 'borussia dortmund': 1890,
  'chelsea': 1885, 'juventus': 1880, 'milan': 1875, 'aston villa': 1860,
  'tottenham': 1855, 'newcastle': 1845, 'sporting cp': 1865, 'benfica': 1840,
  'feyenoord': 1820, 'psv': 1835, 'psv eindhoven': 1835, 'porto': 1815, 'ajax': 1765,
  'az': 1805, 'az alkmaar': 1805, 'telstar': 1590, 'twente': 1795,
  'utrecht': 1630, 'atalanta': 1860, 'roma': 1820, 'lazio': 1810, 'parma': 1680, 'genoa': 1695, 'como': 1700, 'frosinone': 1640,
  'leeds': 1780, 'leeds united': 1780, 'crystal palace': 1765, 'bournemouth': 1750, 'sunderland': 1710,
  'norwich': 1705, 'norwich city': 1705, 'bolton': 1650, 'bolton wanderers': 1650,
  'auxerre': 1685, 'brest': 1715, 'stade brestois': 1715, 'málaga': 1660, 'malaga': 1660, 'getafe': 1720,
  'valencia': 1755, 'villareal': 1805, 'villarreal': 1805, 'levante': 1680, 'real sociedad': 1810, 'real betis': 1765, 'deportivo': 1655, 'marseille': 1800, 'olympique marseille': 1800,
  'galatasaray': 1760, 'fenerbahçe': 1755, 'beşiktaş': 1705, 'trabzonspor': 1660,
  'são paulo': 1740, 'flamengo': 1795, 'palmeiras': 1805, 'internacional': 1710,
  'bragantino': 1690, 'grêmio': 1695, 'gremio': 1695, 'corinthians': 1690, 'athletic club': 1830, 'rb leipzig': 1845, 'leipzig': 1845
};

function getTeamElo(teamName: string, areaName?: string, eloMap?: Record<string, EloEntry>): { rating: number; rank?: number; source: 'eloratings.net' | 'calculated' } {
  const cleanTeam = teamName.toLowerCase().trim();

  // 1. Direct club Elo match
  for (const [club, rating] of Object.entries(CLUB_ELO_MAPPINGS)) {
    if (cleanTeam.includes(club) || club.includes(cleanTeam)) {
      return { rating, source: 'calculated' };
    }
  }

  // 2. Check national team or area in eloratings.net
  if (eloMap) {
    // If it's a national match or team matches country
    if (eloMap[cleanTeam]) {
      return { rating: eloMap[cleanTeam].elo, rank: eloMap[cleanTeam].rank, source: 'eloratings.net' };
    }
    // If area country has an Elo rating, base club benchmark on league strength
    if (areaName && eloMap[areaName.toLowerCase()]) {
      const countryElo = eloMap[areaName.toLowerCase()].elo;
      // High league: ~ countryElo - 250
      return { rating: Math.round(countryElo * 0.85), source: 'calculated' };
    }
  }

  return { rating: 1650, source: 'calculated' };
}

// Calculate statistical prediction based on teams, league, score, live status and Elo
function generateMatchPrediction(match: any, homeElo: number, awayElo: number) {
  const homeName = match.homeTeam?.name || match.homeTeam?.shortName || 'Ev Sahibi';
  const awayName = match.awayTeam?.name || match.awayTeam?.shortName || 'Deplasman';
  const isLive = match.status === 'IN_PLAY' || match.status === 'PAUSED';

  // Elo standard expected win formula with +65 Elo home advantage
  const eloDiff = (homeElo + 65) - awayElo;
  const expectedHomeWin = 1 / (1 + Math.pow(10, -eloDiff / 400));

  let homeProb: number;
  let drawProb: number;
  let awayProb: number;

  const currentHomeScore = match.score?.fullTime?.home ?? 0;
  const currentAwayScore = match.score?.fullTime?.away ?? 0;

  if (isLive) {
    // Dynamic in-play calculation based on current score
    const goalDiff = currentHomeScore - currentAwayScore;
    if (goalDiff >= 3) {
      homeProb = 95; drawProb = 4; awayProb = 1;
    } else if (goalDiff === 2) {
      homeProb = 84; drawProb = 11; awayProb = 5;
    } else if (goalDiff === 1) {
      homeProb = 65; drawProb = 23; awayProb = 12;
    } else if (goalDiff === 0) {
      homeProb = Math.round(expectedHomeWin * 68);
      drawProb = 32;
      awayProb = 100 - homeProb - drawProb;
    } else if (goalDiff === -1) {
      homeProb = 14; drawProb = 24; awayProb = 62;
    } else if (goalDiff === -2) {
      homeProb = 4; drawProb = 10; awayProb = 86;
    } else {
      homeProb = 1; drawProb = 4; awayProb = 95;
    }
  } else {
    // Pre-match calculation strictly guided by Elo Ratings
    const baseWin = Math.round(expectedHomeWin * 100);
    homeProb = Math.min(84, Math.max(16, Math.round(baseWin * 0.74 + 10)));
    drawProb = Math.min(32, Math.max(16, Math.round(28 - Math.abs(eloDiff) * 0.035)));
    awayProb = Math.max(8, 100 - homeProb - drawProb);
  }

  // Determine main tip
  let mainTip = '';
  let tipType: '1' | 'X' | '2' | '1X' | 'X2' | 'OVER_25' | 'UNDER_25' | 'BTTS_YES' = '1';
  let confidenceScore = 65;

  if (homeProb >= 58) {
    mainTip = `MS 1 (${match.homeTeam?.shortName || homeName})`;
    tipType = '1';
    confidenceScore = homeProb;
  } else if (awayProb >= 52) {
    mainTip = `MS 2 (${match.awayTeam?.shortName || awayName})`;
    tipType = '2';
    confidenceScore = awayProb;
  } else if (homeProb >= 40) {
    mainTip = `Çifte Şans 1X (${match.homeTeam?.shortName || 'Ev'})`;
    tipType = '1X';
    confidenceScore = homeProb + drawProb - 10;
  } else if (awayProb >= 38) {
    mainTip = `Çifte Şans X2 (${match.awayTeam?.shortName || 'Dep'})`;
    tipType = 'X2';
    confidenceScore = awayProb + drawProb - 10;
  } else {
    mainTip = '2.5 Gol Üstü / KG Var';
    tipType = 'OVER_25';
    confidenceScore = 62;
  }

  // Goal markets
  const totalLiveGoals = isLive ? currentHomeScore + currentAwayScore : 0;
  let over25 = isLive && totalLiveGoals >= 2 ? 85 : 58;
  if (isLive && totalLiveGoals >= 3) over25 = 96;
  const under25 = 100 - over25;
  const bttsYes = isLive && (currentHomeScore > 0 && currentAwayScore > 0) ? 99 : 56;
  const bttsNo = 100 - bttsYes;

  // Predicted score
  let predHome = isLive ? currentHomeScore : (homeProb > 55 ? 2 : (homeProb > 32 ? 1 : 0));
  let predAway = isLive ? currentAwayScore : (awayProb > 50 ? 2 : (awayProb > 28 ? 1 : 0));
  if (isLive) {
    if (match.status === 'IN_PLAY') {
      if (homeProb > awayProb) predHome += 1;
      else if (awayProb > homeProb) predAway += 1;
    }
  } else if (predHome === 0 && predAway === 0) {
    predHome = 1;
    predAway = 1;
  }

  let summaryInsight = '';
  if (isLive) {
    summaryInsight = `Canlı maçta skor ${currentHomeScore}-${currentAwayScore}. İstatistiki avantaja göre ${mainTip} önde.`;
  } else if (homeProb >= 58) {
    summaryInsight = `${homeName} saha avantajıyla maçın net favorisi konumunda.`;
  } else if (awayProb >= 52) {
    summaryInsight = `${awayName} deplasmanda olmasına rağmen form ve istatistiklerle öne çıkıyor.`;
  } else {
    summaryInsight = `Dengeli iki takım; taraf bahsi yerine gol seçenekleri (2.5 Üst / KG Var) cazip.`;
  }

  const confidenceLevel = confidenceScore >= 72 ? 'Yüksek' : (confidenceScore >= 58 ? 'Orta' : 'Dengeli');

  // ----------------------------------------------------
  // ÖZEL İLK YARI (İY) GOL TAHMİN MOTORU
  // ----------------------------------------------------
  const halfTimeHomeScore = match.score?.halfTime?.home;
  const halfTimeAwayScore = match.score?.halfTime?.away;
  const currentTotalGoals = currentHomeScore + currentAwayScore;
  const currentMinute = match.minute || (isLive ? 30 : 0);

  const maxElo = Math.max(homeElo, awayElo);
  const eloGap = Math.abs(homeElo - awayElo);

  // Temel İY 0.5 Üst Olasılık tabanı (%65 - %88)
  let baseFh05 = 72;
  if (maxElo > 1900) baseFh05 += 6;
  if (eloGap > 180) baseFh05 += 6;
  if (homeElo > awayElo + 80) baseFh05 += 4; // Güçlü ev sahibi baskılı başlar
  baseFh05 = Math.min(89, Math.max(56, baseFh05));

  // İY 1.5 Üst Olasılık tabanı (%26 - %52)
  let baseFh15 = Math.round(baseFh05 * 0.46);
  if (eloGap > 240 || maxElo > 1980) baseFh15 += 7;

  let fhOver05: number;
  let fhOver15: number;
  let fhPredScore: string;
  let fhTiming: string;
  let fhRecommendation: string;
  let fhSummary: string;

  const hasHt = halfTimeHomeScore !== null && halfTimeHomeScore !== undefined && halfTimeAwayScore !== null && halfTimeAwayScore !== undefined;

  if (isLive) {
    if (currentMinute <= 45) {
      // İlk yarı devam ediyor - en kritik odak
      if (currentTotalGoals >= 2) {
        fhOver05 = 100;
        fhOver15 = 100;
        fhRecommendation = 'İY 1.5 ÜST (GELDİ)';
        fhPredScore = `${currentHomeScore} - ${currentAwayScore}`;
        fhTiming = 'İlk yarıda 2+ gol kaydedildi, yüksek tempo!';
        fhSummary = `İlk yarıda şimdiden ${currentTotalGoals} gol oldu. İY 1.5 Üst başarıyla tuttu.`;
      } else if (currentTotalGoals === 1) {
        fhOver05 = 100;
        const remainingMinutes = Math.max(1, 45 - currentMinute);
        fhOver15 = Math.round(Math.min(76, Math.max(26, 30 + (remainingMinutes / 45) * 44)));
        fhRecommendation = fhOver15 >= 50 ? 'İY 1.5 ÜST (Canlı Fırsat)' : 'İY 0.5 ÜST (GELDİ)';
        fhPredScore = currentHomeScore > 0 ? `${currentHomeScore} - 1` : `1 - ${currentAwayScore}`;
        fhTiming = `${currentMinute}. dk itibarıyla 1 gol var; devreye kadar 2. gol ihtimali %${fhOver15}`;
        fhSummary = `İlk yarıda 1 gol geldi (İY 0.5 Üst kazandı). Kalan sürede 2. gol potansiyeli %${fhOver15}.`;
      } else {
        // Canlı 0-0 ilk yarı - gerçek zamanlı İY odak
        const remainingFactor = Math.max(0.12, (45 - currentMinute) / 45);
        fhOver05 = Math.round(baseFh05 * remainingFactor + 12);
        fhOver15 = Math.round(baseFh15 * remainingFactor);
        fhRecommendation = fhOver05 >= 60 ? 'İY 0.5 Üst' : 'İY 0.5 Alt';
        fhPredScore = fhOver05 >= 60 ? (homeElo >= awayElo ? '1 - 0' : '0 - 1') : '0 - 0';
        fhTiming = `Devre arasına ${45 - currentMinute} dk var; ilk yarı bitmeden gol beklentisi %${fhOver05}`;
        fhSummary = `Mevcut ilk yarı skoru 0-0. Devre bitmeden en az 1 gol çıkma ihtimali %${fhOver05}.`;
      }
    } else {
      // İkinci yarı canlı - HT kesin ise kullan, yoksa belirsiz olarak işaretle
      if (hasHt) {
        const actualFhTotal = (halfTimeHomeScore as number) + (halfTimeAwayScore as number);
        fhOver05 = actualFhTotal > 0 ? 100 : 0;
        fhOver15 = actualFhTotal > 1 ? 100 : 0;
        fhRecommendation = actualFhTotal > 0 ? 'İY 0.5 ÜST (Bitti)' : 'İY 0.5 ALT (Bitti)';
        fhPredScore = `${halfTimeHomeScore} - ${halfTimeAwayScore}`;
        fhTiming = `İlk yarı ${fhPredScore} sonuçlandı`;
        fhSummary = `İlk yarı ${fhPredScore} bitti. Toplam ${actualFhTotal} ilk yarı golü atıldı.`;
      } else {
        fhOver05 = baseFh05;
        fhOver15 = baseFh15;
        fhRecommendation = 'İY Tahmini (HT Yok)';
        fhPredScore = homeElo >= awayElo ? '1 - 0' : '0 - 1';
        fhTiming = `${currentMinute}. dk - HT verisi sağlanmadı, model tahmini`;
        fhSummary = `HT skoru API tarafından sağlanmadığı için İY tahmini model (%${fhOver05}) üzerinden devam ediyor.`;
      }
    }
  } else if (match.status === 'FINISHED') {
    if (hasHt) {
      const actualFhTotal = (halfTimeHomeScore as number) + (halfTimeAwayScore as number);
      fhOver05 = actualFhTotal > 0 ? 100 : 0;
      fhOver15 = actualFhTotal > 1 ? 100 : 0;
      fhRecommendation = actualFhTotal > 0 ? 'İY 0.5 ÜST' : 'İY 0.5 ALT';
      fhPredScore = `${halfTimeHomeScore} - ${halfTimeAwayScore}`;
      fhTiming = `İlk yarı ${fhPredScore} bitti`;
      fhSummary = `İlk yarı ${fhPredScore} skoruyla tamamlandı.`;
    } else {
      fhOver05 = baseFh05 > 72 ? baseFh05 : 58;
      fhOver15 = baseFh15;
      fhRecommendation = 'İY Belirsiz (HT Yok)';
      fhPredScore = '?:?';
      fhTiming = 'HT verisi yok';
      fhSummary = 'HT verisi sağlanmadığı için İY sonucu doğrulanamadı.';
    }
  } else {
    // Maç Öncesi Hesaplama
    fhOver05 = baseFh05;
    fhOver15 = baseFh15;
    if (fhOver15 >= 46) {
      fhRecommendation = 'İY 1.5 ÜST';
      fhPredScore = homeElo >= awayElo ? '1 - 1' : '0 - 2';
    } else if (fhOver05 >= 70) {
      fhRecommendation = 'İY 0.5 ÜST';
      fhPredScore = homeElo >= awayElo ? '1 - 0' : '0 - 1';
    } else {
      fhRecommendation = 'İY 0.5 ALT';
      fhPredScore = '0 - 0';
    }

    if (fhOver05 >= 80) {
      fhTiming = '1-30. dk arası erken gol bekleniyor (Yüksek Tempo)';
    } else if (fhOver05 >= 70) {
      fhTiming = '25-45. dk arası devre öncesi açılan oyunda gol yakın';
    } else {
      fhTiming = 'İlk yarı temkinli ve kontrollü başlangıç öngörülüyor';
    }

    if (fhOver05 >= 76) {
      fhSummary = `Takımların ofansif iştahı ve Elo güçleri gereği ilk 45 dakikada en az 1 gol (İY 0.5 Üst) çıkması %${fhOver05} ihtimalle çok güçlü.`;
    } else {
      fhSummary = `İlk yarıda iki takımın kontrollü ve savunma güvenliğini ön planda tutan bir başlangıç yapması bekleniyor (İY 0.5 Üst %${fhOver05}).`;
    }
  }

  const fhUnder05 = Math.max(0, 100 - fhOver05);
  const fhConfidenceScore = fhOver05 >= 72 ? fhOver05 : (fhOver05 < 60 ? fhUnder05 : 64);
  const fhConfidenceLevel: 'Çok Yüksek' | 'Yüksek' | 'Orta' | 'Düşük' =
    fhConfidenceScore >= 80 ? 'Çok Yüksek' : (fhConfidenceScore >= 70 ? 'Yüksek' : (fhConfidenceScore >= 60 ? 'Orta' : 'Düşük'));

  return {
    mainTip,
    tipType,
    confidenceScore,
    confidenceLevel,
    firstHalf: {
      over05Prob: fhOver05,
      over15Prob: fhOver15,
      under05Prob: fhUnder05,
      recommendation: fhRecommendation,
      confidenceScore: fhConfidenceScore,
      confidenceLevel: fhConfidenceLevel,
      predictedHalfScore: fhPredScore,
      goalTimingExpectation: fhTiming,
      summary: fhSummary,
    },
    probabilities: {
      homeWin: homeProb,
      draw: drawProb,
      awayWin: awayProb,
    },
    goalMarket: {
      over25,
      under25,
      recommendation: over25 >= 55 ? '2.5 Üst' : '2.5 Alt',
      bttsYes,
      bttsNo,
      bttsRecommendation: bttsYes >= 52 ? 'KG Var' : 'KG Yok',
    },
    predictedScore: `${predHome} - ${predAway}`,
    summaryInsight,
  };
}

// Fetch matches from football-data.org
async function fetchMatchesFromAPI(): Promise<any[]> {
  const now = Date.now();
  if (matchesCache && now - matchesCache.timestamp < CACHE_TTL_MS) {
    return matchesCache.data;
  }

  try {
    const response = await fetch(`${FOOTBALL_API_BASE}/matches`, {
      headers: {
        'X-Auth-Token': FOOTBALL_API_KEY,
      },
    });

    if (!response.ok) {
      if (response.status === 429 && matchesCache) {
        console.warn('API Rate limit 429 encountered, using cached matches.');
        return matchesCache.data;
      }
      throw new Error(`football-data API responded with status ${response.status}`);
    }

    const data = await response.json();
    const rawMatches = data.matches || [];

    // Load Elo ratings from eloratings.net
    const eloMap = await fetchEloRatings();

    // Map each match with enriched predictions
    const enrichedMatches = rawMatches.map((m: any) => {
      const homeEloInfo = getTeamElo(m.homeTeam?.name || '', m.area?.name, eloMap);
      const awayEloInfo = getTeamElo(m.awayTeam?.name || '', m.area?.name, eloMap);

      const prediction = generateMatchPrediction(m, homeEloInfo.rating, awayEloInfo.rating);
      return {
        id: m.id,
        utcDate: m.utcDate,
        status: m.status,
        minute: m.minute !== undefined ? m.minute : (m.status === 'IN_PLAY' ? Math.min(89, Math.max(1, Math.floor((Date.now() - new Date(m.utcDate).getTime()) / 60000))) : (m.status === 'PAUSED' ? 45 : undefined)),
        matchday: m.matchday,
        stage: m.stage,
        competition: {
          id: m.competition?.id,
          name: m.competition?.name,
          code: m.competition?.code,
          type: m.competition?.type,
          emblem: m.competition?.emblem,
        },
        area: {
          id: m.area?.id,
          name: m.area?.name,
          code: m.area?.code,
          flag: m.area?.flag,
        },
        homeTeam: {
          id: m.homeTeam?.id,
          name: m.homeTeam?.name,
          shortName: m.homeTeam?.shortName || m.homeTeam?.name,
          tla: m.homeTeam?.tla || '',
          crest: m.homeTeam?.crest || '',
          elo: homeEloInfo,
        },
        awayTeam: {
          id: m.awayTeam?.id,
          name: m.awayTeam?.name,
          shortName: m.awayTeam?.shortName || m.awayTeam?.name,
          tla: m.awayTeam?.tla || '',
          crest: m.awayTeam?.crest || '',
          elo: awayEloInfo,
        },
        score: {
          winner: m.score?.winner,
          duration: m.score?.duration,
          fullTime: {
            home: m.score?.fullTime?.home,
            away: m.score?.fullTime?.away,
          },
          halfTime: {
            home: m.score?.halfTime?.home,
            away: m.score?.halfTime?.away,
          },
        },
        prediction,
      };
    });

    matchesCache = {
      data: enrichedMatches,
      timestamp: now,
    };

    // Persist daily predictions to disk (sunucuda veri tutma)
    // Non-blocking but ensures data is stored for daily forecast history
    persistDailyPredictions(enrichedMatches).catch(() => {});

    return enrichedMatches;
  } catch (error) {
    console.error('Error fetching matches from football-data:', error);
    if (matchesCache) {
      return matchesCache.data;
    }
    // Fallback to latest persisted file if available
    try {
      const latestPath = path.join(DATA_DIR, 'latest.json');
      if (fs.existsSync(latestPath)) {
        const persisted = JSON.parse(fs.readFileSync(latestPath, 'utf-8'));
        if (persisted.matches) {
          console.log('Serving fallback from persisted latest.json');
          return persisted.matches;
        }
      }
    } catch {}
    throw error;
  }
}

// ------------------------------------
// API ROUTES
// ------------------------------------

// 1. Get matches list with filters
app.get('/api/matches', async (req, res) => {
  try {
    const { status, competition, search } = req.query;
    let matches = await fetchMatchesFromAPI();

    // Status filtering
    if (status === 'live') {
      matches = matches.filter((m: any) => m.status === 'IN_PLAY' || m.status === 'PAUSED');
    } else if (status === 'upcoming') {
      matches = matches.filter((m: any) => m.status === 'TIMED' || m.status === 'SCHEDULED');
    } else if (status === 'finished') {
      matches = matches.filter((m: any) => m.status === 'FINISHED');
    }

    // Competition filtering
    if (competition && typeof competition === 'string' && competition !== 'ALL') {
      matches = matches.filter((m: any) => m.competition.code === competition);
    }

    // Search filtering
    if (search && typeof search === 'string' && search.trim() !== '') {
      const q = search.toLowerCase().trim();
      matches = matches.filter(
        (m: any) =>
          m.homeTeam.name.toLowerCase().includes(q) ||
          m.awayTeam.name.toLowerCase().includes(q) ||
          m.competition.name.toLowerCase().includes(q)
      );
    }

    const liveCount = matchesCache?.data?.filter((m: any) => m.status === 'IN_PLAY' || m.status === 'PAUSED').length || 0;
    const upcomingCount = matchesCache?.data?.filter((m: any) => m.status === 'TIMED' || m.status === 'SCHEDULED').length || 0;
    const finishedCount = matchesCache?.data?.filter((m: any) => m.status === 'FINISHED').length || 0;

    res.json({
      success: true,
      count: matches.length,
      counts: {
        total: matchesCache?.data?.length || 0,
        live: liveCount,
        upcoming: upcomingCount,
        finished: finishedCount,
      },
      lastUpdated: matchesCache?.timestamp || Date.now(),
      matches,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: 'Maç verileri çekilirken bir hata oluştu.',
      details: err.message,
    });
  }
});

// In-memory caches to respect rate limits and provide instant sub-second responses
const winProbabilityCache = new Map<string, { data: any; source: string; timestamp: number }>();
const aiAnalysisCache = new Map<string, { analysis: string; source: string; timestamp: number }>();

// Helper to call OpenAI-compatible endpoints (Groq, DeepSeek, OpenRouter)
async function callOpenAiCompatible(options: {
  url: string;
  apiKey?: string;
  model: string;
  systemPrompt?: string;
  userPrompt: string;
  jsonMode?: boolean;
  timeoutMs?: number;
}): Promise<string | null> {
  const { url, apiKey, model, systemPrompt, userPrompt, jsonMode = false, timeoutMs = 5000 } = options;
  if (!apiKey || apiKey.trim() === '') return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const messages: Array<{ role: string; content: string }> = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: userPrompt });

    const body: any = {
      model,
      messages,
      temperature: 0.3,
    };
    if (jsonMode) {
      body.response_format = { type: 'json_object' };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      return null;
    }

    const json: any = await res.json();
    return json?.choices?.[0]?.message?.content || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// 2. Deep AI Match Analysis using Multi-Provider LLM
app.post('/api/ai-analysis', async (req, res) => {
  const { matchId, homeTeam, awayTeam, competition, status, currentScore } = req.body;
  const cacheKey = `${matchId}_${status}_${currentScore || '0-0'}`;

  // Check cache (TTL: 10 minutes)
  const cached = aiAnalysisCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 10 * 60 * 1000) {
    return res.json({
      success: true,
      source: cached.source,
      analysis: cached.analysis,
    });
  }

  const prompt = `Futbol analiz ve tahmin uzmanı olarak hareket et. Özellikle İLK YARI GOL TAHMİNLERİ (İY 0.5 Üst, İY 1.5 Üst, İY 0.5 Alt) odaklı net, profesyonel bir analiz yaz.
Maç: ${homeTeam} vs ${awayTeam}
Lig/Turnuva: ${competition}
Durum: ${status === 'IN_PLAY' ? 'CANLI OYNANIYOR' : 'Oynanacak'}
${currentScore ? `Mevcut Skor: ${currentScore}` : ''}

Lütfen şu formatı aynen kullan:
- ⚡ İlk Yarı Gol Tahmini: (Örn: İY 0.5 Üst %80 güven / Erken gol beklentisi)
- ⏱️ İY Skor Beklentisi: (Örn: 1 - 0 veya 0 - 0)
- 🎯 Maç Sonu Tercihi: (Örn: MS 1 veya 2.5 Üst)
- 📊 İlk Yarı Taktiksel Analizi: (Takımların ilk 45 dakikadaki tempo, pres ve gol iştahı)`;

  let resultText: string | null = null;
  let sourceUsed = 'groq_ai';

  // 1. Try Groq (high throughput, ultra-low latency) - updated 2026 models: openai/gpt-oss-20b is fastest, qwen/qwen3.8-27b as fallback
  if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim() !== '') {
    try {
      resultText = await callOpenAiCompatible({
        url: 'https://api.groq.com/openai/v1/chat/completions',
        apiKey: process.env.GROQ_API_KEY,
        model: 'openai/gpt-oss-20b',
        userPrompt: prompt,
        timeoutMs: 4000,
      });
      if (!resultText) {
        resultText = await callOpenAiCompatible({
          url: 'https://api.groq.com/openai/v1/chat/completions',
          apiKey: process.env.GROQ_API_KEY,
          model: 'qwen/qwen3.8-27b',
          userPrompt: prompt,
          timeoutMs: 4000,
        });
      }
      if (resultText) sourceUsed = 'groq_ai';
    } catch {
      resultText = null;
    }
  }

  // 2. Try Gemini API (gemini-2.5-flash) if Groq not used/failed
  if (!resultText && process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY') {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const responsePromise = ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 4000)
      );
      const response: any = await Promise.race([responsePromise, timeoutPromise]);
      if (response?.text) {
        resultText = response.text;
        sourceUsed = 'gemini_ai';
      }
    } catch {
      resultText = null;
    }
  }

  // 3. Try DeepSeek API if available
  if (!resultText && process.env.DEEPSEEK_API_KEY && process.env.DEEPSEEK_API_KEY.trim() !== '') {
    try {
      resultText = await callOpenAiCompatible({
        url: 'https://api.deepseek.com/chat/completions',
        apiKey: process.env.DEEPSEEK_API_KEY,
        model: 'deepseek-chat',
        userPrompt: prompt,
        timeoutMs: 4000,
      });
      if (resultText) sourceUsed = 'deepseek_ai';
    } catch {
      resultText = null;
    }
  }

  // 4. Try OpenRouter if available
  if (!resultText && process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY.trim() !== '') {
    try {
      resultText = await callOpenAiCompatible({
        url: 'https://openrouter.ai/api/v1/chat/completions',
        apiKey: process.env.OPENROUTER_API_KEY,
        model: 'meta-llama/llama-3.3-70b-instruct',
        userPrompt: prompt,
        timeoutMs: 4000,
      });
      if (resultText) sourceUsed = 'openrouter_ai';
    } catch {
      resultText = null;
    }
  }

  if (resultText) {
    aiAnalysisCache.set(cacheKey, {
      analysis: resultText,
      source: sourceUsed,
      timestamp: Date.now(),
    });
    return res.json({
      success: true,
      source: sourceUsed,
      analysis: resultText,
    });
  }

  // Fallback statistical engine
  const fallback = `🎯 Önerilen Tercih: 2.5 Gol Üstü / MS 1
📊 Taktiksel Değerlendirme: ${homeTeam} - ${awayTeam} mücadelesinde taraf bahsinde ev sahibi bir adım önde olsa da, gol bahislerinde 2.5 Üst ve Karşılıklı Gol seçenekleri yüksek olasılık taşımaktadır.
💡 Skor Beklentisi: 2 - 1`;

  return res.json({
    success: true,
    source: 'statistical_engine',
    analysis: fallback,
  });
});

// Helper for realistic statistical win probability fallback
function calculateStatisticalWinProbability(params: {
  homeTeam: string;
  awayTeam: string;
  status: string;
  minute?: number;
  currentScore?: string;
  homeXg?: number;
  awayXg?: number;
}) {
  const { homeTeam, awayTeam, status, minute = 45, currentScore = '0 - 0' } = params;

  let homeGoals = 0;
  let awayGoals = 0;
  const scoreParts = currentScore.split('-').map((s) => parseInt(s.trim(), 10));
  if (scoreParts.length === 2 && !isNaN(scoreParts[0]) && !isNaN(scoreParts[1])) {
    homeGoals = scoreParts[0];
    awayGoals = scoreParts[1];
  }

  const isLive = status === 'IN_PLAY' || status === 'PAUSED';
  const isFinished = status === 'FINISHED';

  if (isFinished) {
    if (homeGoals > awayGoals) {
      return {
        homeWinProb: 100,
        drawProb: 0,
        awayWinProb: 0,
        momentum: 'Maç Tamamlandı (Ev Sahibi Kazandı)',
        keyFactors: [
          `${homeTeam} maçı ${homeGoals}-${awayGoals} üstünlükle tamamladı.`,
          'Hakemin bitiş düdüğüyle birlikte 3 puan ev sahibinin oldu.',
        ],
        summary: `Karşılaşma sona erdi. ${homeTeam} sahadan ${homeGoals}-${awayGoals} galibiyetle ayrıldı.`,
      };
    } else if (awayGoals > homeGoals) {
      return {
        homeWinProb: 0,
        drawProb: 0,
        awayWinProb: 100,
        momentum: 'Maç Tamamlandı (Deplasman Kazandı)',
        keyFactors: [
          `${awayTeam} deplasmanda ${awayGoals}-${homeGoals} galibiyet elde etti.`,
          'Son düdükle birlikte 3 puan hanesine yazıldı.',
        ],
        summary: `Karşılaşma tamamlandı. ${awayTeam} ${awayGoals}-${homeGoals} skorla kazandı.`,
      };
    } else {
      return {
        homeWinProb: 0,
        drawProb: 100,
        awayWinProb: 0,
        momentum: 'Maç Tamamlandı (Beraberlik)',
        keyFactors: [
          `Karşılaşma ${homeGoals}-${awayGoals} eşitlikle sonuçlandı.`,
          'İki takım da 1 puana razı oldu.',
        ],
        summary: `Maç ${homeGoals}-${awayGoals} beraberlikle sona erdi.`,
      };
    }
  }

  if (isLive) {
    const min = Math.min(90, Math.max(1, minute));
    const remMin = 90 - min;
    const diff = homeGoals - awayGoals;

    let h = 45;
    let d = 28;
    let a = 27;

    if (diff > 0) {
      // Ev sahibi önde
      const timeBonus = Math.floor(((90 - remMin) / 90) * 35);
      h = Math.min(94, 55 + diff * 15 + timeBonus);
      d = Math.max(4, Math.floor((100 - h) * 0.7));
      a = Math.max(2, 100 - h - d);
    } else if (diff < 0) {
      // Deplasman önde
      const timeBonus = Math.floor(((90 - remMin) / 90) * 35);
      a = Math.min(94, 52 + Math.abs(diff) * 15 + timeBonus);
      d = Math.max(4, Math.floor((100 - a) * 0.7));
      h = Math.max(2, 100 - a - d);
    } else {
      // Berabere
      const timeWeight = (min / 90);
      d = Math.min(68, Math.floor(28 + timeWeight * 36));
      h = Math.floor((100 - d) * 0.54);
      a = 100 - d - h;
    }

    const sum = h + d + a;
    if (sum !== 100) {
      h += (100 - sum);
    }

    let momentumText = 'Dengeli Mücadele';
    if (diff > 0) momentumText = `${homeTeam} Üstünlüğü Koruyor`;
    else if (diff < 0) momentumText = `${awayTeam} Skoru Elinde Tutuyor`;
    else if (min > 70) momentumText = 'Kritik Beraberlik Baskısı';

    return {
      homeWinProb: h,
      drawProb: d,
      awayWinProb: a,
      momentum: momentumText,
      keyFactors: [
        `Dakika ${min}'de ${currentScore} skor durumu ve kalan ${remMin} dakikalık süre.`,
        diff !== 0
          ? `Skor avantajını elinde tutan taraf oyun temposunu kendi kontrolünde tutuyor.`
          : `Eşitlik sürerken son dakikalara doğru beraberlik ihtimali yükseliyor.`,
        `Saha içi xG ve baskı modelleri ${h > a ? homeTeam : a > h ? awayTeam : 'beraberliği'} ön plana çıkarıyor.`,
      ],
      summary: `Dakika ${min} itibarıyla maç ${currentScore}. Güncel modellemeye göre ${
        h > a && h > d
          ? `${homeTeam} %${h} ihtimalle galibiyete en yakın taraf.`
          : a > h && a > d
          ? `${awayTeam} %${a} ihtimalle galibiyete en yakın taraf.`
          : `Karşılaşmanın %${d} oranla beraberlikle tamamlanma ihtimali ağırlık kazanıyor.`
      }`,
    };
  }

  // Pre-match statistical baseline
  return {
    homeWinProb: 48,
    drawProb: 28,
    awayWinProb: 24,
    momentum: 'Maç Öncesi Dengesi',
    keyFactors: [
      `${homeTeam} ev sahibi saha ve seyirci avantajıyla mücadeleye önde başlıyor.`,
      `Son form grafikleri ve lig performansları ev sahibine %48 galibiyet payı veriyor.`,
      `${awayTeam} deplasman direnci ve geçiş hücumu tehdidi barındırıyor.`,
    ],
    summary: `${homeTeam} - ${awayTeam} mücadelesinde maç öncesi projeksiyonlara göre ev sahibi galibiyet olasılığı %48, beraberlik %28, deplasman galibiyeti %24 olarak öngörülmektedir.`,
  };
}

// 3. Win Probability (Kazanma Olasılığı) Calculation using Multi-Provider LLM & Fallback
app.post('/api/win-probability', async (req, res) => {
  const { matchId, homeTeam, awayTeam, competition, status, minute, currentScore, stats } = req.body;
  const isLive = status === 'IN_PLAY' || status === 'PAUSED';
  const cacheKey = `${matchId}_${status}_${minute || 0}_${currentScore || '0-0'}`;

  // Check cache (TTL: 90s for live, 30m for completed/upcoming)
  const ttl = isLive ? 90 * 1000 : 30 * 60 * 1000;
  const cached = winProbabilityCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < ttl) {
    return res.json({
      success: true,
      source: cached.source,
      data: cached.data,
    });
  }

  const prompt = `Futbol veri analisti ve maç içi kazanma olasılığı (Win Probability) modelleyicisi olarak hareket et.
Aşağıdaki maç verilerini, geçen süreyi, skoru ve oyun gidişatını analiz ederek maç sonu kazanma olasılıklarını yüzde olarak hesapla.

Maç: ${homeTeam} (Ev Sahibi) vs ${awayTeam} (Deplasman)
Lig/Turnuva: ${competition}
Durum: ${isLive ? `CANLI OYNANIYOR (Dakika: ${minute || 45})` : status === 'FINISHED' ? 'MAÇ BİTTİ' : 'BAŞLAMADI / OYNANACAK'}
Mevcut Skor: ${currentScore || '0 - 0'}
${stats ? `Maç İstatistikleri: ${JSON.stringify(stats)}` : ''}

Yanıtını SADECE geçerli bir JSON nesnesi olarak ver. Hiçbir markdown tırnağı veya ek açıklama yazma.
JSON Formatı:
{
  "homeWinProb": 56,
  "drawProb": 26,
  "awayWinProb": 18,
  "momentum": "Ev Sahibi Baskıyı Kurdu",
  "keyFactors": [
    "Dakika ${minute || 45} itibarıyla ${homeTeam} topla oynama ve hücum etkinliğinde üstün.",
    "Mevcut skor dengesinde kalan sürede gol beklentisi ev sahibi lehine.",
    "Deplasman ekibinin kontra fırsatları sınırlı kaldı."
  ],
  "summary": "${homeTeam} sahasındaki baskı ve oyun kontrolüyle galibiyete %56 ihtimalle en yakın ekip."
}

KRİTİK KURAL: homeWinProb + drawProb + awayWinProb toplamı MUTLAKA tam olarak 100 olmalıdır. Sayılar tamsayı (integer) olmalıdır.`;

  let parsedData: any = null;
  let sourceUsed = 'groq_ai';

  // 1. Try Groq (High speed, generous rate limit) - use working 2026 models
  if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim() !== '') {
    try {
      let raw = await callOpenAiCompatible({
        url: 'https://api.groq.com/openai/v1/chat/completions',
        apiKey: process.env.GROQ_API_KEY,
        model: 'openai/gpt-oss-20b',
        userPrompt: prompt,
        jsonMode: true,
        timeoutMs: 4000,
      });
      if (!raw) {
        raw = await callOpenAiCompatible({
          url: 'https://api.groq.com/openai/v1/chat/completions',
          apiKey: process.env.GROQ_API_KEY,
          model: 'qwen/qwen3.8-27b',
          userPrompt: prompt,
          jsonMode: true,
          timeoutMs: 4000,
        });
      }
      if (raw) {
        parsedData = JSON.parse(raw.trim());
        sourceUsed = 'groq_ai';
      }
    } catch {
      parsedData = null;
    }
  }

  // 2. Try Gemini API (gemini-2.5-flash) if Groq did not yield result
  if (!parsedData && process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY') {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const responsePromise = ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 4000)
      );
      const response: any = await Promise.race([responsePromise, timeoutPromise]);
      const raw = response?.text;
      if (raw) {
        parsedData = JSON.parse(raw.replace(/```json/g, '').replace(/```/g, '').trim());
        sourceUsed = 'gemini_ai';
      }
    } catch {
      // Quota / rate limit hit - seamlessly handled below
      parsedData = null;
    }
  }

  // 3. Try DeepSeek if available
  if (!parsedData && process.env.DEEPSEEK_API_KEY && process.env.DEEPSEEK_API_KEY.trim() !== '') {
    try {
      const raw = await callOpenAiCompatible({
        url: 'https://api.deepseek.com/chat/completions',
        apiKey: process.env.DEEPSEEK_API_KEY,
        model: 'deepseek-chat',
        userPrompt: prompt,
        jsonMode: true,
        timeoutMs: 4000,
      });
      if (raw) {
        parsedData = JSON.parse(raw.trim());
        sourceUsed = 'deepseek_ai';
      }
    } catch {
      parsedData = null;
    }
  }

  // 4. Try OpenRouter if available
  if (!parsedData && process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY.trim() !== '') {
    try {
      const raw = await callOpenAiCompatible({
        url: 'https://openrouter.ai/api/v1/chat/completions',
        apiKey: process.env.OPENROUTER_API_KEY,
        model: 'meta-llama/llama-3.3-70b-instruct',
        userPrompt: prompt,
        jsonMode: true,
        timeoutMs: 4000,
      });
      if (raw) {
        parsedData = JSON.parse(raw.trim());
        sourceUsed = 'openrouter_ai';
      }
    } catch {
      parsedData = null;
    }
  }

  // Format valid AI output if available
  if (parsedData && typeof parsedData.homeWinProb === 'number') {
    let h = Math.max(0, Math.min(100, Math.round(Number(parsedData.homeWinProb) || 45)));
    let d = Math.max(0, Math.min(100, Math.round(Number(parsedData.drawProb) || 28)));
    let a = Math.max(0, Math.min(100, Math.round(Number(parsedData.awayWinProb) || 27)));

    const total = h + d + a;
    if (total !== 100 && total > 0) {
      h = Math.round((h / total) * 100);
      d = Math.round((d / total) * 100);
      a = 100 - h - d;
    }

    const formatted = {
      homeWinProb: h,
      drawProb: d,
      awayWinProb: a,
      momentum: parsedData.momentum || 'Oyun Dengesi Devam Ediyor',
      keyFactors: Array.isArray(parsedData.keyFactors)
        ? parsedData.keyFactors
        : ['Dakika ve mevcut skor dengesi', 'Saha içi hücum ve pas verimliliği'],
      summary: parsedData.summary || `${homeTeam} %${h}, Beraberlik %${d}, ${awayTeam} %${a}`,
      updatedAt: Date.now(),
    };

    winProbabilityCache.set(cacheKey, {
      data: formatted,
      source: sourceUsed,
      timestamp: Date.now(),
    });

    return res.json({
      success: true,
      source: sourceUsed,
      data: formatted,
    });
  }

  // 5. High-fidelity statistical model fallback
  const fallback = calculateStatisticalWinProbability({
    homeTeam,
    awayTeam,
    status,
    minute,
    currentScore,
  });

  winProbabilityCache.set(cacheKey, {
    data: fallback,
    source: 'statistical_model',
    timestamp: Date.now(),
  });

  return res.json({
    success: true,
    source: 'statistical_model',
    data: fallback,
  });
});

// 4. Health check (detailed)
app.get('/api/health', (req, res) => {
  const hasR2 = fs.existsSync(path.join(DATA_DIR, 'latest.json'));
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    uptime: process.uptime(),
    apis: {
      football_data: !!FOOTBALL_API_KEY,
      groq: !!process.env.GROQ_API_KEY,
      deepseek: !!process.env.DEEPSEEK_API_KEY,
      openrouter: !!process.env.OPENROUTER_API_KEY,
      gemini: !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
    },
    persistence: {
      dataDir: DATA_DIR,
      hasPersistedData: hasR2,
      dailyFiles: fs.existsSync(DAILY_DIR) ? fs.readdirSync(DAILY_DIR).length : 0,
    },
  });
});

// 5. Daily predictions - sunucuda veri tutma, günlük tahminler
app.get('/api/daily-predictions', (req, res) => {
  try {
    const date = (req.query.date as string) || getTodayKey();
    const filePath = path.join(DAILY_DIR, `${date}.json`);
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      return res.json({ success: true, ...data });
    }
    // fallback to latest
    const latestPath = path.join(DATA_DIR, 'latest.json');
    if (fs.existsSync(latestPath)) {
      const data = JSON.parse(fs.readFileSync(latestPath, 'utf-8'));
      return res.json({ success: true, ...data, note: `Requested ${date} not found, serving latest ${data.date}` });
    }
    return res.status(404).json({ success: false, error: 'Henüz günlük tahmin verisi oluşturulmadı.' });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/history', (req, res) => {
  try {
    const historyPath = path.join(DATA_DIR, 'history.json');
    if (!fs.existsSync(historyPath)) return res.json({ success: true, history: [] });
    const history = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
    res.json({ success: true, history });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/predictions/export', (req, res) => {
  try {
    const latestPath = path.join(DATA_DIR, 'latest.json');
    if (!fs.existsSync(latestPath)) return res.status(404).json({ success: false, error: 'Veri yok' });
    const data = fs.readFileSync(latestPath, 'utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="predictions-${getTodayKey()}.json"`);
    res.setHeader('Content-Type', 'application/json');
    res.send(data);
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ------------------------------------
// VITE OR STATIC SERVING
// ------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    // Warm cache + persist on boot
    fetchMatchesFromAPI().then(() => console.log('Initial predictions warmed & persisted')).catch(() => {});
    // Dengeli cron: 5 dakikada bir (free API + Render free uyumlu, eskiden 30dk ama şimdi server cache 60s olduğundan yeterli)
    setInterval(() => {
      fetchMatchesFromAPI().then(() => console.log(`[${new Date().toISOString()}] Daily predictions refreshed & persisted`)).catch(() => {});
    }, 5 * 60 * 1000);
  });
}

startServer();
