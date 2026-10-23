import React from 'react';
import { 
  Waves, 
  Sparkles, 
  Scale, 
  Smartphone, 
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
    <header className="border-b border-cyan-900/15 bg-white/95 backdrop-blur-md sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-16 flex items-center justify-between gap-3">
          
          {/* Brand */}
          <div 
            onClick={() => onSelectTab('sve')}
            className="flex items-center space-x-3 shrink-0 cursor-pointer"
          >
            <img 
              src="/pwa-192x192.png" 
              alt="RiboPrognoza ikona" 
              className="h-10 w-10 rounded-xl object-cover shadow-sm ring-2 ring-cyan-500/20 shrink-0" 
              referrerPolicy="no-referrer" 
            />
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="font-black text-slate-900 text-base sm:text-lg leading-tight tracking-tight">
                  RiboPrognoza
                </h1>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-800 border border-cyan-200">
                  Uživo
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                Aljmaš (mvodostaji.voda.hr) • Bogojevo (hidmet.gov.rs) • Solunar
              </p>
            </div>
          </div>

          {/* Navigacijski tabovi za brzi pregled */}
          <nav className="hidden md:flex items-center gap-1.5 bg-slate-100/90 p-1 rounded-xl border border-slate-200 text-xs font-bold">
            <button
              onClick={() => onSelectTab('sve')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'sve'
                  ? 'bg-white text-cyan-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Kompletan pregled
            </button>
            <button
              onClick={() => onSelectTab('aljmas')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'aljmas'
                  ? 'bg-teal-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🌊 Aljmaš (mvodostaji)
            </button>
            <button
              onClick={() => onSelectTab('bogojevo')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'bogojevo'
                  ? 'bg-cyan-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🌊 Bogojevo (hidmet)
            </button>
            <button
              onClick={() => onSelectTab('solunar')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'solunar'
                  ? 'bg-indigo-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🌙 Dnevni Solunar
            </button>
            <button
              onClick={() => onSelectTab('usporedba')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'usporedba'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ⚖️ Usporedba
            </button>
          </nav>

          {/* Desna strana: Jedini gumb za osvježavanje podataka */}
          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="flex items-center gap-2 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold text-white bg-cyan-700 hover:bg-cyan-800 transition-all shadow-xs cursor-pointer active:scale-95"
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
