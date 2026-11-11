import React from 'react';
import { 
  Sparkles, 
  LayoutDashboard,
  MessageSquare,
  Trophy,
  Compass,
  Fish
} from 'lucide-react';
import { APP_FEATURES } from '../config/features';

interface AndroidBottomNavProps {
  viewMode: 'basic' | 'expert';
  activeTab: 'sve' | 'aljmas' | 'bogojevo' | 'solunar' | 'usporedba';
  isSolunarOpen?: boolean;
  onSelectBasicMode: () => void;
  onSelectExpertTab: (tab: 'sve' | 'aljmas' | 'bogojevo' | 'solunar' | 'usporedba') => void;
  onOpenSolunar?: () => void;
  onOpenLovostaj: () => void;
  onOpenChat: () => void;
  onOpenCatchLog?: () => void;
  unreadChatCount?: number;
}

export const AndroidBottomNav: React.FC<AndroidBottomNavProps> = ({
  viewMode,
  activeTab,
  isSolunarOpen = false,
  onSelectBasicMode,
  onSelectExpertTab,
  onOpenSolunar,
  onOpenLovostaj,
  onOpenChat,
  onOpenCatchLog,
  unreadChatCount = 0
}) => {
  // Broj vidljivih stavki za optimalno i simetrično poravnanje (npr. 4 stupca kad su Pro i Chat suspendirani)
  const showPro = APP_FEATURES.ENABLE_PRO_MODE;
  const showChat = APP_FEATURES.ENABLE_LIVE_CHAT;
  
  let gridColsClass = 'grid-cols-4';
  if (showPro && showChat) gridColsClass = 'grid-cols-6';
  else if (showPro || showChat) gridColsClass = 'grid-cols-5';

  return (
    <nav 
      aria-label="Mobilna navigacija"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/98 backdrop-blur-md border-t border-slate-800 text-white shadow-[0_-4px_20px_rgba(0,0,0,0.5)] px-1 py-1 pb-safe w-full max-w-full overflow-hidden"
    >
      <div className={`grid ${gridColsClass} items-center text-center w-full`}>
        
        {/* 1. Osnovni mod */}
        <button
          onClick={onSelectBasicMode}
          className={`flex flex-col items-center justify-center py-1.5 transition-all cursor-pointer active:scale-95 ${
            viewMode === 'basic' && !isSolunarOpen ? 'text-teal-300 font-black' : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Osnovni mod (Glavni pregled)"
        >
          <div className="relative">
            <LayoutDashboard className="w-5 h-5 mb-0.5" />
            {viewMode === 'basic' && !isSolunarOpen && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-teal-400 shadow-sm shadow-teal-400/80" />
            )}
          </div>
          <span className="text-[10px] leading-tight font-bold mt-0.5">Osnovni</span>
        </button>

        {/* 2. Pro mod (prikazuje se isključivo ako je Pro mod omogućen) */}
        {showPro && (
          <button
            onClick={() => onSelectExpertTab('sve')}
            className={`flex flex-col items-center justify-center py-1.5 transition-all cursor-pointer active:scale-95 ${
              viewMode === 'expert' && activeTab === 'sve' ? 'text-cyan-300 font-black' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Pro ribolovni mod (Detaljna analitika)"
          >
            <Compass className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] leading-tight font-bold mt-0.5">Pro mod</span>
          </button>
        )}

        {/* 3. Solunar */}
        <button
          onClick={() => {
            if (onOpenSolunar) onOpenSolunar();
            else onSelectExpertTab('solunar');
          }}
          className={`flex flex-col items-center justify-center py-1.5 transition-all cursor-pointer active:scale-95 ${
            isSolunarOpen || (viewMode === 'expert' && activeTab === 'solunar') 
              ? 'text-indigo-300 font-black' 
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Dnevni Solunar i vrijeme griza"
        >
          <div className="relative">
            <Sparkles className="w-5 h-5 mb-0.5 text-indigo-400" />
            {isSolunarOpen && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-sm shadow-indigo-400/80" />
            )}
          </div>
          <span className="text-[10px] leading-tight font-bold mt-0.5">Solunar</span>
        </button>

        {/* 4. Lovostaj */}
        <button
          onClick={onOpenLovostaj}
          className="flex flex-col items-center justify-center py-1.5 transition-all cursor-pointer text-emerald-400 hover:text-emerald-300 font-bold active:scale-95"
          title="Pravilnik: Lovostaj i minimalne mjere"
        >
          <Fish className="w-5 h-5 mb-0.5 text-emerald-400" />
          <span className="text-[10px] leading-tight text-emerald-200 mt-0.5">Lovostaj</span>
        </button>

        {/* 5. Evidencija ulova */}
        <button
          onClick={onOpenCatchLog}
          className="flex flex-col items-center justify-center py-1.5 transition-all cursor-pointer text-amber-400 hover:text-amber-300 font-bold active:scale-95"
          title="Otvori Evidenciju ulova po vrstama ribe"
        >
          <Trophy className="w-5 h-5 mb-0.5 text-amber-400" />
          <span className="text-[10px] leading-tight text-amber-200 mt-0.5">Ulovi</span>
        </button>

        {/* 6. LiveChat (prikazuje se isključivo ako je LiveChat omogućen) */}
        {showChat && (
          <button
            onClick={onOpenChat}
            className="relative flex flex-col items-center justify-center py-1.5 transition-all cursor-pointer text-teal-400 hover:text-teal-300 font-bold active:scale-95"
            title="Otvori interni LiveChat"
          >
            {unreadChatCount > 0 && (
              <span className="absolute -top-0.5 right-2 min-w-[16px] h-4 px-0.5 bg-rose-600 text-white text-[9px] font-black rounded-full flex items-center justify-center border border-slate-950 shadow-md animate-pulse">
                {unreadChatCount > 9 ? '9+' : unreadChatCount}
              </span>
            )}
            <MessageSquare className="w-5 h-5 mb-0.5 text-teal-300" />
            <span className="text-[10px] leading-tight text-teal-200 mt-0.5">Chat</span>
          </button>
        )}

      </div>
    </nav>
  );
};
