import React, { useState } from 'react';
import { Flame, Star, ChevronDown, ChevronUp, Clock, Target } from 'lucide-react';
import { Match } from '../types.ts';

interface Props {
  title: string;
  icon?: React.ReactNode;
  matches: Match[];
  favorites: Set<number>;
  onToggleFavorite: (id: number) => void;
  emptyText?: string;
}

function confidenceColor(level: string) {
  if (level === 'Yüksek' || level === 'Çok Yüksek') return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
  if (level === 'Orta') return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
  return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
}

const CompactRow: React.FC<{ match: Match; isFavorite: boolean; onToggleFavorite: (id: number)=>void }> = ({ match, isFavorite, onToggleFavorite }) => {
  const [open, setOpen] = useState(false);
  const isLive = match.status === 'IN_PLAY' || match.status === 'PAUSED';
  const isFinished = match.status === 'FINISHED';
  const d = new Date(match.utcDate);
  const kickoffTime = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const homeScore = match.score?.fullTime?.home;
  const awayScore = match.score?.fullTime?.away;

  const iy = match.prediction.firstHalf;
  const iyBadge = iy.over05Prob >= 72 ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : iy.over05Prob >= 60 ? 'bg-zinc-800 text-zinc-300 border-zinc-700' : 'bg-zinc-900 text-zinc-500 border-zinc-800';

  return (
    <>
      <tr
        onClick={() => setOpen(!open)}
        className={`cursor-pointer transition text-xs border-b border-zinc-800/60 hover:bg-zinc-900/60 ${isLive ? 'bg-red-950/10' : ''} ${open ? 'bg-zinc-900/80' : ''}`}
      >
        {/* Saat / Skor */}
        <td className="px-2.5 py-2.5 whitespace-nowrap text-center w-[78px]">
          {isLive || isFinished ? (
            <div className="flex flex-col items-center gap-0.5">
              <span className={`px-2 py-0.5 rounded-lg font-black text-xs ${isLive ? 'bg-red-500/15 text-red-400 border border-red-500/30' : 'bg-zinc-800 text-zinc-200 border border-zinc-700'}`}>
                {homeScore ?? 0}:{awayScore ?? 0}
              </span>
              {isLive && <span className="text-[10px] text-red-400 font-semibold animate-pulse">{match.minute ? `${match.minute}'` : 'CANLI'}</span>}
              {!isLive && isFinished && <span className="text-[10px] text-zinc-500">MS</span>}
            </div>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 font-medium"><Clock className="w-3 h-3 text-zinc-500" />{kickoffTime}</span>
          )}
        </td>

        {/* Takımlar + Lig */}
        <td className="px-2.5 py-2.5 min-w-[160px]">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              {match.homeTeam.crest && <img src={match.homeTeam.crest} alt="" className="w-5 h-5 object-contain shrink-0" referrerPolicy="no-referrer" />}
              <span className="font-semibold text-zinc-100 truncate max-w-[72px] sm:max-w-[88px]">{match.homeTeam.shortName}</span>
            </div>
            <span className="text-zinc-500 font-bold text-[10px]">vs</span>
            <div className="flex items-center gap-1.5 min-w-0">
              {match.awayTeam.crest && <img src={match.awayTeam.crest} alt="" className="w-5 h-5 object-contain shrink-0" referrerPolicy="no-referrer" />}
              <span className="font-semibold text-zinc-100 truncate max-w-[72px] sm:max-w-[88px]">{match.awayTeam.shortName}</span>
            </div>
          </div>
          <div className="text-[11px] text-zinc-500 truncate mt-0.5 flex items-center gap-1">
            {match.competition.emblem && <img src={match.competition.emblem} alt="" className="w-3 h-3 object-contain" referrerPolicy="no-referrer" />}
            <span className="truncate">{match.competition.name}</span>
          </div>
        </td>

        {/* İY Tahmin */}
        <td className="px-2.5 py-2.5 whitespace-nowrap hidden sm:table-cell">
          <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] font-semibold ${iyBadge}`}>
            <Flame className="w-3 h-3" />
            <span>{iy.recommendation}</span>
            <span className="opacity-80">%{iy.over05Prob}</span>
          </div>
          <div className="text-[10px] text-zinc-500 mt-0.5 font-mono">İY {iy.predictedHalfScore}</div>
        </td>

        {/* MS Tahmin */}
        <td className="px-2.5 py-2.5 whitespace-nowrap hidden md:table-cell">
          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 font-semibold text-xs">
            <Target className="w-3 h-3 text-emerald-400" />
            <span className="text-emerald-400 truncate max-w-[110px]">{match.prediction.mainTip}</span>
          </div>
          <div className={`mt-1 inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold border ${confidenceColor(match.prediction.confidenceLevel)}`}>%{match.prediction.confidenceScore} {match.prediction.confidenceLevel}</div>
        </td>

        {/* Mobilde İY+MS birleştir */}
        <td className="px-2.5 py-2.5 sm:hidden">
          <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[11px] font-semibold ${iyBadge}`}>İY %{iy.over05Prob}</div>
          <div className="text-[11px] text-emerald-400 font-semibold truncate mt-0.5 max-w-[92px]">{match.prediction.mainTip}</div>
        </td>

        {/* Favori + Aç */}
        <td className="px-2 py-2.5 whitespace-nowrap w-[64px] text-center">
          <div className="flex items-center justify-center gap-1">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(match.id); }}
              className={`p-1.5 rounded-lg border transition ${isFavorite ? 'bg-amber-500/20 border-amber-500/30 text-amber-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-amber-400'}`}
              title={isFavorite ? 'Favoriden çıkar' : 'Favoriye ekle'}
            >
              <Star className={`w-3.5 h-3.5 ${isFavorite ? 'fill-amber-400' : ''}`} />
            </button>
            <span className="text-zinc-600">{open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}</span>
          </div>
        </td>
      </tr>
      {open && (
        <tr className="bg-zinc-950/50 border-b border-zinc-800">
          <td colSpan={5} className="px-3 py-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1.5">
                <div className="text-[11px] font-bold text-amber-400 uppercase flex items-center gap-1"><Flame className="w-3 h-3" />İlk Yarı</div>
                <div className="flex flex-wrap gap-1.5 text-[11px]">
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/20">İY 0.5 Üst %{iy.over05Prob}</span>
                  <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">İY 1.5 Üst %{iy.over15Prob}</span>
                  <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 border border-zinc-700">Alt %{iy.under05Prob}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden flex"><div style={{width: `${iy.over05Prob}%`}} className="h-full bg-gradient-to-r from-amber-500 to-emerald-500" /><div style={{width: `${iy.under05Prob}%`}} className="h-full bg-zinc-700" /></div>
                <div className="text-[11px] text-zinc-400"><span className="text-amber-300 font-semibold">{iy.goalTimingExpectation}.</span> {iy.summary}</div>
                <div className="text-[11px]"><span className="text-zinc-500">İY Skor:</span> <span className="font-mono font-bold text-amber-300">{iy.predictedHalfScore}</span></div>
              </div>
              <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1.5">
                <div className="text-[11px] font-bold text-emerald-400 uppercase flex items-center gap-1"><Target className="w-3 h-3" />Maç Sonu</div>
                <div className="font-bold text-emerald-400">{match.prediction.mainTip}</div>
                <div className="flex justify-between text-[11px] text-zinc-400"><span>1 %{match.prediction.probabilities.homeWin}</span><span>X %{match.prediction.probabilities.draw}</span><span>2 %{match.prediction.probabilities.awayWin}</span></div>
                <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden flex"><div style={{width: `${match.prediction.probabilities.homeWin}%`}} className="h-full bg-emerald-500" /><div style={{width: `${match.prediction.probabilities.draw}%`}} className="h-full bg-amber-500" /><div style={{width: `${match.prediction.probabilities.awayWin}%`}} className="h-full bg-blue-500" /></div>
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  <div className="p-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-center"><span className="text-[10px] text-zinc-500 block">2.5 Gol</span><span className="font-semibold text-zinc-200">{match.prediction.goalMarket.recommendation} %{match.prediction.goalMarket.over25 >=55 ? match.prediction.goalMarket.over25 : match.prediction.goalMarket.under25}</span></div>
                  <div className="p-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-center"><span className="text-[10px] text-zinc-500 block">KG</span><span className="font-semibold text-zinc-200">{match.prediction.goalMarket.bttsRecommendation} %{match.prediction.goalMarket.bttsYes}</span></div>
                </div>
                <div className="text-[11px]"><span className="text-zinc-500">Skor:</span> <span className="font-bold text-white font-mono">{match.prediction.predictedScore}</span></div>
              </div>
              <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1.5">
                <div className="text-[11px] font-bold text-zinc-400 uppercase">Analiz</div>
                <p className="text-[11px] leading-relaxed text-zinc-300">{match.prediction.summaryInsight}</p>
                <div className="flex flex-wrap gap-1.5 text-[10px] text-zinc-500">
                  <span className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700">ELO Ev {match.homeTeam.elo?.rating ?? '-'}</span>
                  <span className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700">ELO Dep {match.awayTeam.elo?.rating ?? '-'}</span>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

export const CompactMatchTable: React.FC<Props> = ({ title, icon, matches, favorites, onToggleFavorite, emptyText }) => {
  if (matches.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-6 text-center">
        <div className="text-sm font-semibold text-zinc-300 flex items-center justify-center gap-2">{icon}{title}</div>
        <p className="text-xs text-zinc-500 mt-1">{emptyText || 'Maç bulunamadı.'}</p>
      </div>
    );
  }
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
      <div className="px-3 py-2.5 bg-zinc-950/60 border-b border-zinc-800 flex items-center justify-between">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">{icon}{title} <span className="px-1.5 py-0.5 rounded-full bg-zinc-800 text-[11px] text-zinc-300 border border-zinc-700">{matches.length}</span></h3>
        <span className="text-[11px] text-zinc-500 hidden sm:inline">Satıra tıkla → detay</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="bg-zinc-950/40 text-[11px] text-zinc-500 uppercase tracking-wider">
            <tr className="border-b border-zinc-800">
              <th className="px-2.5 py-2 font-semibold text-center w-[78px]">Saat/Skor</th>
              <th className="px-2.5 py-2 font-semibold text-left">Maç</th>
              <th className="px-2.5 py-2 font-semibold text-left hidden sm:table-cell">İY Tahmin</th>
              <th className="px-2.5 py-2 font-semibold text-left hidden md:table-cell">MS Tahmin</th>
              <th className="px-2.5 py-2 font-semibold text-left sm:hidden">Tahmin</th>
              <th className="px-2 py-2 font-semibold text-center w-[64px]">★</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((m) => (
              <CompactRow key={m.id} match={m} isFavorite={favorites.has(m.id)} onToggleFavorite={onToggleFavorite} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
