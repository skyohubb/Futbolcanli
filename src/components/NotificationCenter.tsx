import React, { useState, useEffect } from 'react';
import {
  Bell,
  BellRing,
  BellOff,
  Volume2,
  VolumeX,
  Flame,
  Zap,
  CheckCircle2,
  X,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import { notificationService, GoalSignal } from '../services/notificationService.ts';

interface NotificationCenterProps {
  recentSignals: GoalSignal[];
  activeToast: GoalSignal | null;
  onCloseToast: () => void;
  onSelectMatch?: (matchId: number) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  recentSignals,
  activeToast,
  onCloseToast,
  onSelectMatch,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => {
    if (notificationService.isSupported()) {
      setPermission(notificationService.getPermission());
    }
  }, []);

  const handleRequestPermission = async () => {
    const result = await notificationService.requestPermission();
    setPermission(result);
    if (result === 'granted') {
      notificationService.sendTestSignal();
    }
  };

  const handleSendTest = () => {
    notificationService.sendTestSignal();
  };

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold ${
          permission === 'granted'
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
            : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
        }`}
        title="Canlı Gol ve İY Sinyalleri Bildirim Merkezi"
      >
        {permission === 'granted' ? (
          <BellRing className="w-4 h-4 text-amber-400 animate-pulse" />
        ) : (
          <Bell className="w-4 h-4" />
        )}
        <span className="hidden sm:inline">Sinyal Alarmı</span>
        {recentSignals.length > 0 && (
          <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-black text-[10px] font-extrabold">
            {recentSignals.length}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-zinc-950 border border-zinc-800 shadow-2xl p-4 z-50 space-y-3.5 backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Flame className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-white">Canlı Sinyal Bildirimleri</h3>
                <p className="text-[11px] text-zinc-400">İY Gol Fırsatları & Kritik Baskı</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Browser Notification Permission Banner */}
          <div className="p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="font-semibold text-zinc-200">Tarayıcı Bildirimi:</span>
                {permission === 'granted' ? (
                  <span className="text-emerald-400 flex items-center gap-1 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Açık
                  </span>
                ) : permission === 'denied' ? (
                  <span className="text-red-400 flex items-center gap-1 font-bold">
                    <ShieldAlert className="w-3.5 h-3.5" /> Engellendi
                  </span>
                ) : (
                  <span className="text-amber-400 font-bold">İzin Bekleniyor</span>
                )}
              </div>

              {permission !== 'granted' && (
                <button
                  type="button"
                  onClick={handleRequestPermission}
                  className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition cursor-pointer shadow"
                >
                  İzin Ver
                </button>
              )}
            </div>

            <p className="text-[11px] text-zinc-400 leading-relaxed">
              {permission === 'granted'
                ? 'Canlı maçlarda yüksek ilk yarı gol potansiyeli ve anlık xG baskısı oluştuğunda masaüstü bildirimi alacaksınız.'
                : 'Canlı gol sinyallerini sekme arka plandayken bile anında yakalamak için tarayıcı bildirim iznini aktif edin.'}
            </p>

            {/* Quick Controls: Sound toggle & Test button */}
            <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80">
              <button
                type="button"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                  soundEnabled
                    ? 'bg-zinc-800 text-zinc-200 border-zinc-700'
                    : 'bg-zinc-900 text-zinc-500 border-zinc-800'
                }`}
              >
                {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5" />}
                <span>Ses: {soundEnabled ? 'Açık' : 'Kapalı'}</span>
              </button>

              <button
                type="button"
                onClick={handleSendTest}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition cursor-pointer"
              >
                <span>Test Bildirimi Gönder</span>
              </button>
            </div>
          </div>

          {/* Recent Signals List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="font-semibold text-zinc-300">Yakalanan Canlı Sinyaller</span>
              <span>{recentSignals.length} Sinyal</span>
            </div>

            {recentSignals.length === 0 ? (
              <div className="p-4 text-center text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
                Henüz yeni sinyal tetiklenmedi. Canlı maçlar ve yüksek İY olasılıkları periyodik olarak taranmaktadır.
              </div>
            ) : (
              <div className="max-h-56 overflow-y-auto space-y-2 pr-1 no-scrollbar">
                {recentSignals.map((sig) => (
                  <div
                    key={sig.id}
                    onClick={() => {
                      if (onSelectMatch) onSelectMatch(sig.matchId);
                      setIsOpen(false);
                    }}
                    className="p-2.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-900 border border-zinc-800 hover:border-amber-500/40 transition cursor-pointer space-y-1"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-amber-400 flex items-center gap-1">
                        {sig.type === 'FIRST_HALF_GOAL' ? (
                          <Flame className="w-3 h-3 text-amber-400" />
                        ) : (
                          <Zap className="w-3 h-3 text-emerald-400" />
                        )}
                        {sig.homeTeam} - {sig.awayTeam}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-950/60 text-amber-300 font-bold border border-amber-800/40">
                        %{sig.probability}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-300 leading-tight line-clamp-2">
                      {sig.message}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-0.5">
                      <span>{sig.competition}</span>
                      <span>{new Date(sig.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating In-App Toast Popup - fixed to viewport, responsive */}
      {activeToast && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm sm:w-full z-[100] pointer-events-none">
          <div className="pointer-events-auto p-4 rounded-2xl bg-zinc-950 border border-amber-500/50 shadow-2xl space-y-2.5 backdrop-blur-lg animate-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Flame className="w-4 h-4 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold text-white">{activeToast.title}</h4>
                  <span className="text-[10px] text-amber-400 font-medium">{activeToast.competition}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={onCloseToast}
                className="text-zinc-500 hover:text-zinc-300 p-0.5 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-300 leading-snug">
              {activeToast.message}
            </p>

            <div className="flex items-center justify-between pt-1 border-t border-zinc-900 text-xs">
              <span className="text-[11px] text-amber-400 font-bold">
                Olasılık: %{activeToast.probability}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (onSelectMatch) onSelectMatch(activeToast.matchId);
                  onCloseToast();
                }}
                className="text-[11px] font-semibold text-zinc-200 hover:text-white flex items-center gap-1 cursor-pointer"
              >
                <span>Maça Git</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
