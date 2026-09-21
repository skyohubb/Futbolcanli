import React from 'react';
import { Send } from 'lucide-react';

// Sadece yonlendirme - sunucuyu yormaz, API limitine dokunmaz
// URL env'den gelirse kullan, yoksa futbolai_bot'taki @Futboltahminpro_bot fallback
const TELEGRAM_URL = (import.meta as any)?.env?.VITE_TELEGRAM_URL || 'https://t.me/Futboltahminpro_bot';
const TELEGRAM_CHANNEL_NAME = (import.meta as any)?.env?.VITE_TELEGRAM_CHANNEL_NAME || 'Futboltahminpro';

export const TelegramBanner: React.FC = () => {
  return (
    <div className="mx-auto max-w-6xl w-full px-4">
      <a
        href={TELEGRAM_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-between gap-3 p-3 rounded-xl bg-gradient-to-r from-sky-950/40 via-sky-900/30 to-zinc-900/50 border border-sky-500/30 hover:border-sky-500/50 hover:from-sky-950/60 transition cursor-pointer group"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-lg bg-sky-500/20 text-sky-400 border border-sky-500/30 group-hover:bg-sky-500/30 transition">
            <Send className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <span>Telegram'da Takip Et</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">@{TELEGRAM_CHANNEL_NAME}</span>
            </div>
            <p className="text-[11px] text-zinc-400 truncate">Canlı gol anında, kupon ve İY fırsatları — bildirimleri kaçırma</p>
          </div>
        </div>
        <span className="shrink-0 px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold transition hidden sm:inline-flex">Kanala Katıl →</span>
        <span className="shrink-0 px-2.5 py-1 rounded-lg bg-sky-500 text-white text-xs font-bold sm:hidden">Katıl</span>
      </a>
    </div>
  );
};
