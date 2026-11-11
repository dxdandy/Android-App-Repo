import React from 'react';
import { 
  RefreshCw, 
  MessageSquare,
  Sun,
  LayoutDashboard,
  Sparkles,
  Fish,
  Trophy
} from 'lucide-react';
import { APP_FEATURES } from '../config/features';

interface NavbarProps {
  activeTab: 'sve' | 'aljmas' | 'bogojevo' | 'solunar' | 'usporedba';
  onSelectTab: (tab: 'sve' | 'aljmas' | 'bogojevo' | 'solunar' | 'usporedba') => void;
  onResetToBasic?: () => void;
  onRefresh: () => void;
  isLoading: boolean;
  lastUpdated: Date | null;
  onOpenChat: () => void;
  onOpenSolunar?: () => void;
  onOpenLovostaj?: () => void;
  onOpenCatchLog?: () => void;
  unreadChatCount?: number;
  highContrast?: boolean;
  onToggleHighContrast?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  onResetToBasic,
  onRefresh,
  isLoading,
  lastUpdated,
  onOpenChat,
  onOpenSolunar,
  onOpenLovostaj,
  onOpenCatchLog,
  unreadChatCount = 0,
  highContrast = false,
  onToggleHighContrast
}) => {
  const formatTime = (date: Date | null) => {
    if (!date) return '--:--';
    return date.toLocaleTimeString('hr-HR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 backdrop-blur-md border-b shadow-lg pt-[env(safe-area-inset-top,0px)] w-full transition-colors ${
      highContrast && APP_FEATURES.ENABLE_OUTDOOR_SUN_MODE
        ? 'bg-slate-900/98 border-amber-300/80 shadow-[0_2px_18px_rgba(255,255,255,0.16)]' 
        : 'bg-slate-950/95 border-slate-850'
    }`}>
      <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 py-1.5 sm:py-2.5 w-full">
        <div className="flex items-center justify-between gap-1.5 sm:gap-3 w-full">
          
          {/* Brand - klik vraća u Osnovni mod */}
          <div 
            onClick={() => {
              if (onResetToBasic) onResetToBasic();
              else onSelectTab('sve');
            }}
            className="flex items-center gap-2 sm:gap-2.5 min-w-0 cursor-pointer shrink-0 group"
            title="Povratak u Osnovni mod"
          >
            <img 
              src="/pwa-192x192.png" 
              alt="RiboPrognoza ikona" 
              className="h-9 w-9 sm:h-11 sm:w-11 rounded-xl sm:rounded-2xl object-cover shadow-md ring-1 sm:ring-2 ring-cyan-500/30 group-hover:ring-cyan-400/60 transition-all shrink-0" 
              referrerPolicy="no-referrer" 
            />
            <div className="h-9 sm:h-11 py-[1px] flex flex-col justify-between items-start text-left select-none shrink-0">
              <span className="font-black text-white text-[15px] sm:text-[19px] leading-none tracking-tight block">
                Ribo
              </span>
              <span className="font-black text-white text-[15px] sm:text-[19px] leading-none tracking-tight block">
                Prognoza
              </span>
            </div>
          </div>

          {/* Navigacijski tabovi za veće ekrane (desktop / tablet) */}
          <nav className="hidden md:flex items-center gap-1.5 bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-xs font-bold">
            {APP_FEATURES.ENABLE_PRO_MODE ? (
              <>
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
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    if (onResetToBasic) onResetToBasic();
                    else onSelectTab('sve');
                  }}
                  className="px-3 py-1.5 rounded-lg transition-all cursor-pointer bg-slate-800 text-teal-300 shadow-xs border border-teal-500/40 flex items-center gap-1.5 font-black"
                >
                  <LayoutDashboard className="w-3.5 h-3.5 text-teal-400" />
                  <span>⚡ Osnovni mod</span>
                </button>
                <button
                  onClick={() => {
                    if (onOpenSolunar) onOpenSolunar();
                    else onSelectTab('solunar');
                  }}
                  className="px-3 py-1.5 rounded-lg transition-all cursor-pointer text-indigo-300 hover:text-white hover:bg-slate-800/80 flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <span>🌙 Dnevni Solunar</span>
                </button>
                <button
                  onClick={() => onOpenLovostaj && onOpenLovostaj()}
                  className="px-3 py-1.5 rounded-lg transition-all cursor-pointer text-emerald-300 hover:text-white hover:bg-slate-800/80 flex items-center gap-1.5"
                >
                  <Fish className="w-3.5 h-3.5 text-emerald-400" />
                  <span>🐟 Lovostaj</span>
                </button>
                <button
                  onClick={() => onOpenCatchLog && onOpenCatchLog()}
                  className="px-3 py-1.5 rounded-lg transition-all cursor-pointer text-amber-300 hover:text-white hover:bg-slate-800/80 flex items-center gap-1.5"
                >
                  <Trophy className="w-3.5 h-3.5 text-amber-400" />
                  <span>🏆 Evidencija ulova</span>
                </button>
              </>
            )}
          </nav>

          {/* Desna strana: Status, Ažuriraj (+ Sunce i LiveChat ako su omogućeni) */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            
            {/* Elegantni indikator aktivnog praćenja Dunava */}
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-[11px] font-semibold text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400/50" />
              <span>Dunav uživo</span>
            </div>

            {/* Mod za sunce (Visoki kontrast) - prikazuje se isključivo ako je funkcija uključena */}
            {APP_FEATURES.ENABLE_OUTDOOR_SUN_MODE && onToggleHighContrast && (
              <button
                type="button"
                onClick={onToggleHighContrast}
                className={`h-9 sm:h-10 min-w-[46px] sm:min-w-[54px] px-3 sm:px-3.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer active:scale-95 shrink-0 ${
                  highContrast
                    ? 'bg-amber-400 text-slate-950 border-amber-200 shadow-lg shadow-amber-500/20 font-black'
                    : 'bg-slate-900/95 hover:bg-slate-800 text-amber-300 border-amber-400/50 shadow-md'
                }`}
                title="Uključi/isključi visoki kontrast za bolju čitljivost na jakom suncu"
              >
                <Sun
                  className={`w-5 h-5 sm:w-6 sm:h-6 shrink-0 ${
                    highContrast ? 'text-slate-950 fill-slate-950' : 'text-amber-300 fill-amber-400/30'
                  }`}
                  strokeWidth={2.4}
                />
                <span className="hidden sm:inline text-xs font-extrabold">Sunce</span>
              </button>
            )}

            {/* Gumb za interni LiveChat - prikazuje se isključivo ako je funkcija uključena */}
            {APP_FEATURES.ENABLE_LIVE_CHAT && (
              <button
                type="button"
                onClick={onOpenChat}
                className="relative h-8 sm:h-10 flex items-center gap-1.5 px-2 sm:px-3 py-1 rounded-xl text-xs font-bold text-teal-200 bg-teal-950/90 hover:bg-teal-900 transition-all shadow-md border border-teal-500/40 cursor-pointer active:scale-95 shrink-0"
                title="Otvori interni LiveChat"
              >
                {unreadChatCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-4.5 px-1 bg-rose-600 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-slate-950 shadow-lg animate-pulse">
                    {unreadChatCount > 99 ? '99+' : unreadChatCount}
                  </span>
                )}
                <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-400 shrink-0" />
                <div className="flex flex-col text-left leading-tight">
                  <span className="text-white font-bold text-[11px] sm:text-xs">LiveChat</span>
                  <span className="text-[9px] text-teal-300 font-normal hidden xs:inline">Dunav</span>
                </div>
              </button>
            )}

            {/* Gumb za ažuriranje */}
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className="h-8.5 sm:h-10 flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1 rounded-xl text-xs font-bold text-white bg-cyan-700 hover:bg-cyan-600 active:scale-95 transition-all shadow-md border border-cyan-500/40 cursor-pointer shrink-0"
              title="Ažuriraj sve hidrometeo i solunarne podatke"
            >
              <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-200 shrink-0 ${isLoading ? 'animate-spin' : ''}`} />
              <div className="flex flex-col text-left leading-tight">
                <span className="text-[11.5px] sm:text-xs font-bold">{isLoading ? 'Učitavam...' : 'Ažuriraj'}</span>
                {lastUpdated && (
                  <span className="text-[9px] text-cyan-200 font-normal hidden xs:inline">
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
