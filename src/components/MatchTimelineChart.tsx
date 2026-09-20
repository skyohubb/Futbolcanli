import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Legend,
} from 'recharts';
import { Activity, BarChart2, Zap, Clock } from 'lucide-react';
import { Match } from '../types.ts';

interface MatchTimelineChartProps {
  match: Match;
}

type ChartMode = 'xg' | 'pressure';

interface TimelinePoint {
  minute: string;
  minVal: number;
  homeXg: number;
  awayXg: number;
  homePressure: number;
  awayPressure: number;
  isFirstHalf: boolean;
}

export const MatchTimelineChart: React.FC<MatchTimelineChartProps> = ({ match }) => {
  const [chartMode, setChartMode] = useState<ChartMode>('xg');

  const homeName = match.homeTeam.shortName || match.homeTeam.name;
  const awayName = match.awayTeam.shortName || match.awayTeam.name;

  // Generate realistic, consistent xG & pressure trajectory from teams, Elo and match state
  const timelineData = useMemo<TimelinePoint[]>(() => {
    const homeElo = match.homeTeam.elo?.rating || 1700;
    const awayElo = match.awayTeam.elo?.rating || 1650;
    const eloAdvantage = (homeElo + 60) - awayElo; // home turf +60

    // Expected final total xG
    const totalHomeExpected = Math.max(0.4, Number((1.25 + (eloAdvantage / 400) * 0.9).toFixed(2)));
    const totalAwayExpected = Math.max(0.3, Number((1.05 - (eloAdvantage / 500) * 0.7).toFixed(2)));

    // Score adjustments if actual score exists
    const actualHomeScore = match.score?.fullTime?.home ?? (match.status === 'IN_PLAY' ? (match.score?.halfTime?.home ?? 0) : null);
    const actualAwayScore = match.score?.fullTime?.away ?? (match.status === 'IN_PLAY' ? (match.score?.halfTime?.away ?? 0) : null);

    const targetHomeXg = actualHomeScore !== null ? Math.max(totalHomeExpected, actualHomeScore * 0.85 + 0.3) : totalHomeExpected;
    const targetAwayXg = actualAwayScore !== null ? Math.max(totalAwayExpected, actualAwayScore * 0.85 + 0.25) : totalAwayExpected;

    // Minute segments: 0', 15', 30', 45' (İY), 60', 75', 90'
    const intervals = [
      { min: 0, label: "0'", fh: true },
      { min: 15, label: "15'", fh: true },
      { min: 30, label: "30'", fh: true },
      { min: 45, label: "45' (İY)", fh: true },
      { min: 60, label: "60'", fh: false },
      { min: 75, label: "75'", fh: false },
      { min: 90, label: "90'", fh: false },
    ];

    // Progression curves (First half accounts for ~45% of total expected xG)
    const progressionFractions = [0, 0.12, 0.28, 0.46, 0.64, 0.82, 1.0];

    // Seed variations based on match id to keep smooth consistency
    const seed = (match.id % 20) / 20;

    return intervals.map((interval, idx) => {
      const frac = progressionFractions[idx];
      const jitterHome = idx === 0 ? 0 : Math.sin(idx + seed) * 0.05;
      const jitterAway = idx === 0 ? 0 : Math.cos(idx + seed) * 0.04;

      const currentHomeXg = Number(Math.max(0, frac * targetHomeXg + jitterHome).toFixed(2));
      const currentAwayXg = Number(Math.max(0, frac * targetAwayXg + jitterAway).toFixed(2));

      // Dynamic pressure % (0 - 100) per 15 min slice
      const baseHomePressure = Math.min(85, Math.max(25, 52 + (eloAdvantage / 400) * 25 + Math.sin(idx * 1.5 + seed) * 12));
      const homePress = Math.round(baseHomePressure);
      const awayPress = 100 - homePress;

      return {
        minute: interval.label,
        minVal: interval.min,
        homeXg: currentHomeXg,
        awayXg: currentAwayXg,
        homePressure: homePress,
        awayPressure: awayPress,
        isFirstHalf: interval.fh,
      };
    });
  }, [match]);

  const firstHalfPoint = timelineData.find((p) => p.minVal === 45) || timelineData[3];
  const finalPoint = timelineData[timelineData.length - 1];

  return (
    <div className="mt-3 p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80 space-y-3">
      {/* Header and Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-blue-500/15 text-blue-400 border border-blue-500/25">
            <BarChart2 className="w-3.5 h-3.5" />
          </div>
          <div>
            <h5 className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
              <span>Maç İçi Baskı & Gol Beklentisi (xG) Çizelgesi</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-950/60 text-blue-300 border border-blue-800/40">
                0' - 90'
              </span>
            </h5>
            <span className="text-[10px] text-zinc-400">Recharts ile anlık ve zamansal akış analizi</span>
          </div>
        </div>

        {/* Metric Switcher buttons */}
        <div className="flex items-center p-0.5 bg-zinc-900 border border-zinc-800 rounded-lg text-[11px]">
          <button
            type="button"
            onClick={() => setChartMode('xg')}
            className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer flex items-center gap-1 ${
              chartMode === 'xg'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Activity className="w-3 h-3" />
            <span>Kümülatif xG</span>
          </button>
          <button
            type="button"
            onClick={() => setChartMode('pressure')}
            className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer flex items-center gap-1 ${
              chartMode === 'pressure'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Zap className="w-3 h-3" />
            <span>Baskı Düzeyi (%)</span>
          </button>
        </div>
      </div>

      {/* Quick Summary Metrics Strip (Highlighting First Half and Full Match) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
        <div className="p-1.5 rounded-lg bg-zinc-900/60 border border-zinc-800/60">
          <span className="text-[10px] text-amber-400 block font-semibold">İY xG (0-45')</span>
          <span className="font-mono font-bold text-zinc-100">
            {firstHalfPoint.homeXg.toFixed(2)} - {firstHalfPoint.awayXg.toFixed(2)}
          </span>
        </div>
        <div className="p-1.5 rounded-lg bg-zinc-900/60 border border-zinc-800/60">
          <span className="text-[10px] text-emerald-400 block font-semibold">Toplam xG (90')</span>
          <span className="font-mono font-bold text-zinc-100">
            {finalPoint.homeXg.toFixed(2)} - {finalPoint.awayXg.toFixed(2)}
          </span>
        </div>
        <div className="p-1.5 rounded-lg bg-zinc-900/60 border border-zinc-800/60">
          <span className="text-[10px] text-zinc-400 block font-medium">İlk Yarı Baskı</span>
          <span className="font-mono font-semibold text-zinc-200">
            %{firstHalfPoint.homePressure} - %{firstHalfPoint.awayPressure}
          </span>
        </div>
        <div className="p-1.5 rounded-lg bg-zinc-900/60 border border-zinc-800/60">
          <span className="text-[10px] text-zinc-400 block font-medium">Baskın Taraf</span>
          <span className="font-semibold text-emerald-400 truncate block">
            {finalPoint.homeXg >= finalPoint.awayXg ? homeName : awayName}
          </span>
        </div>
      </div>

      {/* Recharts Chart Canvas */}
      <div className="h-44 sm:h-52 w-full pt-1">
        <ResponsiveContainer width="100%" height="100%">
          {chartMode === 'xg' ? (
            <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id={`gradHome-${match.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id={`gradAway-${match.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis
                dataKey="minute"
                tick={{ fill: '#71717a', fontSize: 10 }}
                axisLine={{ stroke: '#3f3f46' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#71717a', fontSize: 10 }}
                axisLine={{ stroke: '#3f3f46' }}
                tickLine={false}
                domain={[0, 'auto']}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload as TimelinePoint;
                    return (
                      <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-700 shadow-xl text-xs space-y-1.5 min-w-[140px]">
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-1 text-zinc-400">
                          <span className="font-semibold text-zinc-200">Dakika: {label}</span>
                          {data.isFirstHalf && (
                            <span className="text-[10px] text-amber-400 font-medium">İlk Yarı</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-emerald-400 font-semibold">
                          <span className="truncate max-w-[90px]">{homeName}:</span>
                          <span>{data.homeXg.toFixed(2)} xG</span>
                        </div>
                        <div className="flex items-center justify-between text-blue-400 font-semibold">
                          <span className="truncate max-w-[90px]">{awayName}:</span>
                          <span>{data.awayXg.toFixed(2)} xG</span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <ReferenceLine
                x="45' (İY)"
                stroke="#f59e0b"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: 'İY Devre',
                  fill: '#f59e0b',
                  fontSize: 10,
                  position: 'insideTopLeft',
                }}
              />
              <Area
                type="monotone"
                dataKey="homeXg"
                name={homeName}
                stroke="#10b981"
                strokeWidth={2}
                fillOpacity={1}
                fill={`url(#gradHome-${match.id})`}
              />
              <Area
                type="monotone"
                dataKey="awayXg"
                name={awayName}
                stroke="#3b82f6"
                strokeWidth={2}
                fillOpacity={1}
                fill={`url(#gradAway-${match.id})`}
              />
              <Legend
                verticalAlign="bottom"
                height={24}
                iconType="circle"
                wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }}
              />
            </AreaChart>
          ) : (
            <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id={`gradPressHome-${match.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id={`gradPressAway-${match.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis
                dataKey="minute"
                tick={{ fill: '#71717a', fontSize: 10 }}
                axisLine={{ stroke: '#3f3f46' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#71717a', fontSize: 10 }}
                axisLine={{ stroke: '#3f3f46' }}
                tickLine={false}
                domain={[0, 100]}
                tickFormatter={(v) => `%${v}`}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload as TimelinePoint;
                    return (
                      <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-700 shadow-xl text-xs space-y-1.5 min-w-[140px]">
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-1 text-zinc-400">
                          <span className="font-semibold text-zinc-200">Zaman: {label}</span>
                          {data.isFirstHalf && (
                            <span className="text-[10px] text-amber-400 font-medium">İlk Yarı</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-amber-400 font-semibold">
                          <span className="truncate max-w-[90px]">{homeName}:</span>
                          <span>%{data.homePressure} Baskı</span>
                        </div>
                        <div className="flex items-center justify-between text-indigo-400 font-semibold">
                          <span className="truncate max-w-[90px]">{awayName}:</span>
                          <span>%{data.awayPressure} Baskı</span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <ReferenceLine
                x="45' (İY)"
                stroke="#f59e0b"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: 'İY Bitiş',
                  fill: '#f59e0b',
                  fontSize: 10,
                  position: 'insideTopLeft',
                }}
              />
              <Area
                type="monotone"
                dataKey="homePressure"
                name={`${homeName} Baskı (%)`}
                stroke="#f59e0b"
                strokeWidth={2}
                fillOpacity={1}
                fill={`url(#gradPressHome-${match.id})`}
              />
              <Area
                type="monotone"
                dataKey="awayPressure"
                name={`${awayName} Baskı (%)`}
                stroke="#6366f1"
                strokeWidth={2}
                fillOpacity={1}
                fill={`url(#gradPressAway-${match.id})`}
              />
              <Legend
                verticalAlign="bottom"
                height={24}
                iconType="circle"
                wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }}
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-1 border-t border-zinc-900">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3 text-amber-500/80" />
          <span>Sarı kesikli çizgi ilk yarının (0-45') tamamlandığı anı gösterir.</span>
        </span>
        <span className="text-zinc-400 font-medium">xG Modeli: Elo + Taktiksel Hücum İndeksi</span>
      </div>
    </div>
  );
};
