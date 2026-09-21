import React from 'react';
import { ExternalLink, Play } from 'lucide-react';

// Sponsor: skyohub.com sabit, Play Store Nefes & Egzersiz
const SKYOHUB_URL = 'https://skyohub.com';
// TODO: Nefes & Egzersiz Play Store linkini buraya koy (ornek placeholder asagida)
// Gercek link: Play Console > Nefes & Egzersiz > Mağaza girişi > URL
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.skyohub.nefes';

export const SponsorBar: React.FC = () => {
  return (
    <div className="w-full bg-zinc-950 border-y border-zinc-800">
      <div className="max-w-6xl mx-auto px-4 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <a href={SKYOHUB_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:opacity-90 transition">
          <span className="w-7 h-7 rounded-lg bg-sky-500 flex items-center justify-center text-white font-black text-[10px]">SKY</span>
          <span className="font-bold text-white">skyohub.com</span>
          <span className="text-zinc-500 hidden sm:inline">— Sponsor</span>
          <ExternalLink className="w-3 h-3 text-zinc-500" />
        </a>
        <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-teal-950/60 via-zinc-900 to-zinc-900 border border-teal-500/30 hover:border-teal-500/50 transition w-full sm:w-auto justify-center">
          <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-teal-400 to-amber-400 flex items-center justify-center text-zinc-950 font-black text-[10px]">NE</span>
          <div className="text-left leading-tight">
            <div className="font-bold text-white text-xs">Nefes & Egzersiz</div>
            <div className="text-[10px] text-zinc-400">AURA • Breathe • Focus • Relax — Google Play'de</div>
          </div>
          <span className="ml-2 hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white text-zinc-900 font-bold text-[11px]"><Play className="w-3 h-3 fill-zinc-900" /> Google Play</span>
        </a>
      </div>
    </div>
  );
};

export const SponsorFooterCard: React.FC = () => {
  return (
    <div className="rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900/50">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
        <a href={SKYOHUB_URL} target="_blank" rel="noopener noreferrer" className="p-5 flex gap-4 hover:bg-zinc-900/60 transition cursor-pointer">
          <div className="w-12 h-12 rounded-xl bg-sky-500 flex items-center justify-center text-white font-black shrink-0">SKY</div>
          <div className="min-w-0">
            <div className="text-sm font-black text-white flex items-center gap-2">skyohub.com <ExternalLink className="w-3.5 h-3.5 text-zinc-500" /></div>
            <p className="text-xs text-zinc-400 mt-1">Sponsor — Tüm tahminler skyohub.com desteğiyle sunulur. Güncel analizler için siteyi ziyaret et.</p>
            <span className="inline-flex mt-2 text-xs font-semibold text-sky-400">skyohub.com'a git →</span>
          </div>
        </a>
        <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer" className="p-5 flex gap-4 bg-gradient-to-br from-teal-950/30 via-zinc-900/50 to-amber-950/20 border-t md:border-t-0 md:border-l border-zinc-800 hover:from-teal-950/50 transition cursor-pointer">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-400 via-amber-300 to-teal-500 flex items-center justify-center text-zinc-950 font-black shrink-0">◐</div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-black text-white">Nefes & Egzersiz</div>
            <div className="text-[11px] font-bold text-teal-300 tracking-widest">AURA | MINDFULNESS</div>
            <p className="text-xs text-zinc-400 mt-1">Strength • Recovery • Balance — Daily Workouts 35m • Mindful Meditation 15m • Breathe Focus Relax</p>
            <span className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-lg bg-white text-zinc-900 text-xs font-bold"><Play className="w-3 h-3 fill-zinc-900" /> Google Play'de İndir</span>
          </div>
        </a>
      </div>
      <div className="px-4 py-2 bg-zinc-950/60 border-t border-zinc-800 text-[11px] text-zinc-500 text-center">
        Sponsor içerik • skyohub.com • Nefes & Egzersiz — AURA Mindful Fitness
      </div>
    </div>
  );
};
