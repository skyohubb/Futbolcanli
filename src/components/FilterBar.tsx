import React from 'react';
import { Search, Radio, Clock, CheckCircle2, LayoutGrid, X, Flame, Star } from 'lucide-react';
import { StatusFilter } from '../types.ts';

interface FilterBarProps {
  statusFilter: StatusFilter;
  setStatusFilter: (status: StatusFilter) => void;
  selectedCompetition: string;
  setSelectedCompetition: (comp: string) => void;
  competitions: { code: string; name: string }[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  counts: {
    total: number;
    live: number;
    upcoming: number;
    finished: number;
    firstHalfHot?: number;
    favorites?: number;
  };
}

export const FilterBar: React.FC<FilterBarProps> = ({
  statusFilter,
  setStatusFilter,
  selectedCompetition,
  setSelectedCompetition,
  competitions,
  searchQuery,
  setSearchQuery,
  counts,
}) => {
  return (
    <div className="space-y-3">
      {/* Top row: Status Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Status segment control */}
        <div className="flex items-center p-1 bg-zinc-900/90 border border-zinc-800 rounded-xl overflow-x-auto no-scrollbar">
          {/* Favorites Tab */}
          <button
            type="button"
            onClick={() => setStatusFilter('favorites')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
              statusFilter === 'favorites'
                ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Star
              className={`w-3.5 h-3.5 ${
                statusFilter === 'favorites' ? 'fill-amber-400 text-amber-400' : 'text-amber-400/80'
              }`}
            />
            <span>Favorilerim</span>
            {counts.favorites !== undefined && (
              <span
                className={`ml-1 px-1.5 py-0.2 rounded text-[10px] font-bold border ${
                  statusFilter === 'favorites'
                    ? 'bg-amber-400 text-black border-amber-400'
                    : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                }`}
              >
                {counts.favorites}
              </span>
            )}
          </button>

          {/* First Half Hot Tab */}
          <button
            type="button"
            onClick={() => setStatusFilter('first_half_hot')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
              statusFilter === 'first_half_hot'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span>🔥 İY Gol Fırsatları</span>
            {counts.firstHalfHot !== undefined && (
              <span className="ml-1 px-1.5 py-0.2 rounded bg-amber-950/60 text-[10px] text-amber-300 font-bold border border-amber-800/40">
                {counts.firstHalfHot}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('live')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
              statusFilter === 'live'
                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            <span>Canlı</span>
            <span className="ml-1 px-1.5 py-0.2 rounded bg-zinc-800 text-[10px] text-zinc-300">
              {counts.live}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('upcoming')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap cursor-pointer ${
              statusFilter === 'upcoming'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Oynanacak</span>
            <span className="ml-1 px-1.5 py-0.2 rounded bg-zinc-800 text-[10px] text-zinc-300">
              {counts.upcoming}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Tümü</span>
            <span className="ml-1 px-1.5 py-0.2 rounded bg-zinc-800 text-[10px] text-zinc-300">
              {counts.total}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('finished')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap cursor-pointer ${
              statusFilter === 'finished'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400" />
            <span>Bitenler</span>
            <span className="ml-1 px-1.5 py-0.2 rounded bg-zinc-800 text-[10px] text-zinc-300">
              {counts.finished}
            </span>
          </button>
        </div>

        {/* Search input */}
        <div className="relative min-w-[220px]">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Takım veya lig ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* League pills scrollable row */}
      {competitions.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
          <button
            type="button"
            onClick={() => setSelectedCompetition('ALL')}
            className={`px-3 py-1 rounded-full border transition whitespace-nowrap cursor-pointer ${
              selectedCompetition === 'ALL'
                ? 'bg-zinc-200 text-zinc-950 font-semibold border-zinc-200'
                : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:text-zinc-200 hover:border-zinc-700'
            }`}
          >
            Tüm Ligler
          </button>
          {competitions.map((comp) => (
            <button
              key={comp.code}
              type="button"
              onClick={() => setSelectedCompetition(comp.code)}
              className={`px-3 py-1 rounded-full border transition whitespace-nowrap cursor-pointer ${
                selectedCompetition === comp.code
                  ? 'bg-zinc-200 text-zinc-950 font-semibold border-zinc-200'
                  : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:text-zinc-200 hover:border-zinc-700'
              }`}
            >
              {comp.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
