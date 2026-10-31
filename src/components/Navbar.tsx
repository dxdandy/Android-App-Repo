import React from 'react';
import { 
  Waves, 
  Sparkles, 
  Scale, 
  RefreshCw, 
  CheckCircle2, 
  Clock,
  MessageSquare
} from 'lucide-react';

interface NavbarProps {
  activeTab: 'sve' | 'aljmas' | 'bogojevo' | 'solunar' | 'usporedba';
  onSelectTab: (tab: 'sve' | 'aljmas' | 'bogojevo' | 'solunar' | 'usporedba') => void;
  onRefresh: () => void;
  isLoading: boolean;
  lastUpdated: Date | null;
  onOpenChat: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  onRefresh,
  isLoading,
  lastUpdated,
  onOpenChat
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
              className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl object-cover shadow-sm ring-2 ring-cyan-500/30 shrink-0" 
              referrerPolicy="no-referrer" 
            />
            <div className="h-10 sm:h-11 flex flex-col justify-between text-left select-none py-0.5">
              <span className="font-black text-white text-[15px] sm:text-[17px] leading-none tracking-tight block">
                Ribo
              </span>
              <span className="font-black text-cyan-400 text-[15px] sm:text-[17px] leading-none tracking-tight block">
                Prognoza
              </span>
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
              🌊 Aljmaš
            </button>
            <button
              onClick={() => onSelectTab('bogojevo')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'bogojevo'
                  ? 'bg-cyan-900/70 text-cyan-200 shadow-xs border border-cyan-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🌊 Bogojevo
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

          {/* Desna strana: LiveChat gumb i gumb za osvježavanje podataka (identične visine i veličine) */}
          <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
            {/* Gumb za interni LiveChat */}
            <button
              onClick={onOpenChat}
              className="h-10 sm:h-11 flex items-center gap-2 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold text-teal-200 bg-teal-950/80 hover:bg-teal-900 transition-all shadow-md border border-teal-500/40 cursor-pointer active:scale-95 shrink-0"
              title="Otvori interni LiveChat"
            >
              <MessageSquare className="w-4 h-4 text-teal-400 shrink-0" />
              <div className="flex flex-col text-left leading-tight">
                <span className="text-white font-bold text-xs sm:text-sm">LiveChat</span>
                <span className="text-[10px] text-teal-300 font-normal">Dunav</span>
              </div>
            </button>

            {/* Gumb za ažuriranje */}
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="h-10 sm:h-11 flex items-center gap-2 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold text-white bg-cyan-700 hover:bg-cyan-600 transition-all shadow-md border border-cyan-500/40 cursor-pointer active:scale-95 shrink-0"
              title="Ažuriraj sve hidrometeo i solunarne podatke"
            >
              <RefreshCw className={`w-4 h-4 text-cyan-200 shrink-0 ${isLoading ? 'animate-spin' : ''}`} />
              <div className="flex flex-col text-left leading-tight">
                <span className="text-xs sm:text-sm">{isLoading ? 'Ažuriranje...' : 'Ažuriraj'}</span>
                {lastUpdated && (
                  <span className="text-[10px] text-cyan-200 font-normal">
                    {formatTime(lastUpdated)} h
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
