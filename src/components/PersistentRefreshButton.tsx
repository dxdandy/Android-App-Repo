import React from 'react';
import { RefreshCw, CheckCircle2 } from 'lucide-react';

interface PersistentRefreshButtonProps {
  onRefresh: () => void;
  isLoading: boolean;
  lastUpdated: Date | null;
}

export const PersistentRefreshButton: React.FC<PersistentRefreshButtonProps> = ({
  onRefresh,
  isLoading,
  lastUpdated
}) => {
  const formatTime = (date: Date | null) => {
    if (!date) return '--:--:--';
    return date.toLocaleTimeString('hr-HR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatHoursShort = (date: Date | null) => {
    if (!date) return '';
    return date.toLocaleTimeString('hr-HR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <aside 
      aria-label="Ažuriranje podataka"
      className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex flex-col items-center pointer-events-auto"
    >
      <div className="bg-slate-900/95 text-white backdrop-blur-md border-2 border-cyan-500/80 rounded-2xl shadow-2xl p-2.5 sm:p-3 flex flex-col items-center min-w-[155px] sm:min-w-[175px] transition-all duration-200 hover:border-cyan-400 hover:shadow-cyan-500/20">
        
        {/* Okrugli akcijski gumb za osvježavanje */}
        <button
          onClick={onRefresh}
          disabled={isLoading}
          aria-label="Ažuriraj sve podatke za Dunav"
          className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all duration-300 shadow-md ${
            isLoading 
              ? 'bg-cyan-700 text-white cursor-wait' 
              : 'bg-gradient-to-tr from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 text-white active:scale-95 cursor-pointer ring-4 ring-cyan-500/30'
          }`}
          title="Kliknite za trenutno osvježavanje svih podataka s mvodostaji.voda.hr i hidmet.gov.rs"
        >
          <RefreshCw className={`w-6 h-6 sm:w-7 sm:h-7 ${isLoading ? 'animate-spin' : ''}`} />
        </button>

        {/* Tekst ispod gumba: "Ažuriraj podatke" */}
        <span className="mt-2 text-xs sm:text-sm font-bold tracking-tight text-white text-center leading-tight">
          {isLoading ? 'Ažuriranje...' : 'Ažuriraj podatke'}
        </span>

        {/* Tekst: "u koliko je sati bilo zadnje ažuriranje podataka" */}
        <div className="mt-1 flex items-center gap-1 text-[11px] sm:text-xs text-cyan-300/90 font-medium text-center">
          <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
          <span>
            {lastUpdated 
              ? `Zadnje ažuriranje u ${formatHoursShort(lastUpdated)} sati`
              : 'Nije ažurirano'}
          </span>
        </div>

        {/* Sekunde i datum u malom fontu */}
        {lastUpdated && (
          <span className="text-[10px] text-slate-400 font-mono mt-0.5">
            ({formatTime(lastUpdated)})
          </span>
        )}

      </div>
    </aside>
  );
};
