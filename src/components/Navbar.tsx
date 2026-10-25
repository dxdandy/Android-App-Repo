import React from 'react';
import { 
  Waves, 
  Sparkles, 
  Scale, 
  RefreshCw, 
  CheckCircle2,
  Clock
} from 'lucide-react';

interface NavbarProps {
  activeTab: 'sve' | 'aljmas' | 'bogojevo' | 'solunar' | 'usporedba';
  onSelectTab: (tab: 'sve' | 'aljmas' | 'bogojevo' | 'solunar' | 'usporedba') => void;
  onRefresh: () => void;
  isLoading: boolean;
  lastUpdated: Date | null;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  onRefresh,
  isLoading,
  lastUpdated
}) => {
  const formatTime = (date: Date | null) => {
    if (!date) return '--:--';
    return date.toLocaleTimeString('hr-HR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-slate-950/95 backdrop-blur-md border-b border-slate-800 shadow-lg pt-[max(env(safe-area-inset-top,0px),1.75rem)] sm:pt-[max(env(safe-area-inset-top,0px),0.5rem)] w-full">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="h-16 flex items-center justify-between gap-3">
          
          {/* Brand */}
          <div 
            onClick={() => onSelectTab('sve')}
            className="flex items-center space-x-2.5 sm:space-x-3 shrink-0 cursor-pointer"
          >
            <img 
              src="/pwa-192x192.png" 
              alt="RiboPrognoza ikona" 
              className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl object-cover shadow-sm ring-2 ring-cyan-500/30 shrink-0" 
              referrerPolicy="no-referrer" 
            />
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="font-black text-white text-base sm:text-lg leading-tight tracking-tight">
                  RiboPrognoza
                </h1>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-500/40">
                  Uživo
                </span>
              </div>
            </div>
          </div>

          {/* Navigacijski tabovi za veće ekrane (desktop / tablet) */}
          <nav className="hidden md:flex items-center gap-1.5 bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-xs font-bold">
            <button
              onClick={() => onSelectTab('sve')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'sve'
                  ? 'bg-slate-800 text-cyan-300 shadow-xs border border-cyan-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Kompletan pregled
            </button>
            <button
              onClick={() => onSelectTab('aljmas')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'aljmas'
                  ? 'bg-teal-900/70 text-teal-200 shadow-xs border border-teal-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🌊 Aljmaš (mvodostaji)
            </button>
            <button
              onClick={() => onSelectTab('bogojevo')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'bogojevo'
                  ? 'bg-cyan-900/70 text-cyan-200 shadow-xs border border-cyan-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🌊 Bogojevo (hidmet)
            </button>
            <button
              onClick={() => onSelectTab('solunar')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'solunar'
                  ? 'bg-indigo-900/70 text-indigo-200 shadow-xs border border-indigo-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🌙 Dnevni Solunar
            </button>
            <button
              onClick={() => onSelectTab('usporedba')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'usporedba'
                  ? 'bg-purple-900/70 text-purple-200 shadow-xs border border-purple-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              ⚖️ Usporedba
            </button>
          </nav>

          {/* Desna strana: Glavni gumb za osvježavanje podataka */}
          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="flex items-center gap-2 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold text-white bg-cyan-700 hover:bg-cyan-600 transition-all shadow-md border border-cyan-500/40 cursor-pointer active:scale-95"
              title="Ažuriraj sve hidrometeo i solunarne podatke"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <div className="flex flex-col text-left leading-tight">
                <span>{isLoading ? 'Ažuriranje...' : 'Ažuriraj podatke'}</span>
                {lastUpdated && (
                  <span className="text-[10px] text-cyan-200 font-normal">
                    u {formatTime(lastUpdated)} h
                  </span>
                )}
              </div>
            </button>
          </div>

        </div>
      </div>
    </header>
  );
};
