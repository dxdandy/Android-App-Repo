import React from 'react';
import { 
  Sparkles, 
  LayoutDashboard,
  MessageSquare,
  Trophy,
  Compass,
  Fish
} from 'lucide-react';

interface AndroidBottomNavProps {
  viewMode: 'basic' | 'expert';
  activeTab: 'sve' | 'aljmas' | 'bogojevo' | 'solunar' | 'usporedba';
  onSelectBasicMode: () => void;
  onSelectExpertTab: (tab: 'sve' | 'aljmas' | 'bogojevo' | 'solunar' | 'usporedba') => void;
  onOpenLovostaj: () => void;
  onOpenChat: () => void;
  onOpenCatchLog?: () => void;
  unreadChatCount?: number;
}

export const AndroidBottomNav: React.FC<AndroidBottomNavProps> = ({
  viewMode,
  activeTab,
  onSelectBasicMode,
  onSelectExpertTab,
  onOpenLovostaj,
  onOpenChat,
  onOpenCatchLog,
  unreadChatCount = 0
}) => {
  return (
    <nav 
      aria-label="Mobilna navigacija"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/98 backdrop-blur-md border-t border-slate-800 text-white shadow-2xl px-1 py-1 pb-safe w-full max-w-full overflow-hidden"
    >
      <div className="grid grid-cols-6 items-center text-center w-full">
        
        {/* 1. Osnovni mod */}
        <button
          onClick={onSelectBasicMode}
          className={`flex flex-col items-center justify-center py-1 transition-all cursor-pointer ${
            viewMode === 'basic' ? 'text-teal-300 font-black scale-105' : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Osnovni mod (Glavni pregled)"
        >
          <LayoutDashboard className="w-4.5 h-4.5 mb-0.5" />
          <span className="text-[9.5px] leading-tight font-bold">Osnovni</span>
        </button>

        {/* 2. Pro mod */}
        <button
          onClick={() => onSelectExpertTab('sve')}
          className={`flex flex-col items-center justify-center py-1 transition-all cursor-pointer ${
            viewMode === 'expert' && activeTab === 'sve' ? 'text-cyan-300 font-black scale-105' : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Pro ribolovni mod (Detaljna analitika)"
        >
          <Compass className="w-4.5 h-4.5 mb-0.5" />
          <span className="text-[9.5px] leading-tight font-bold">Pro mod</span>
        </button>

        {/* 3. Solunar */}
        <button
          onClick={() => onSelectExpertTab('solunar')}
          className={`flex flex-col items-center justify-center py-1 transition-all cursor-pointer ${
            viewMode === 'expert' && activeTab === 'solunar' ? 'text-indigo-300 font-black scale-105' : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Dnevni Solunar"
        >
          <Sparkles className="w-4.5 h-4.5 mb-0.5" />
          <span className="text-[9.5px] leading-tight font-bold">Solunar</span>
        </button>

        {/* 4. Lovostaj */}
        <button
          onClick={onOpenLovostaj}
          className="flex flex-col items-center justify-center py-1 transition-all cursor-pointer text-emerald-400 hover:text-emerald-300 font-bold"
          title="Lovostaj i minimalne mjere"
        >
          <Fish className="w-4.5 h-4.5 mb-0.5 text-emerald-400" />
          <span className="text-[9.5px] leading-tight text-emerald-200">Lovostaj</span>
        </button>

        {/* 5. Evidencija ulova */}
        <button
          onClick={onOpenCatchLog}
          className="flex flex-col items-center justify-center py-1 transition-all cursor-pointer text-amber-400 hover:text-amber-300 font-bold"
          title="Otvori Evidenciju ulova po vrstama ribe"
        >
          <Trophy className="w-4.5 h-4.5 mb-0.5 text-amber-400" />
          <span className="text-[9.5px] leading-tight text-amber-200">Ulovi</span>
        </button>

        {/* 6. LiveChat */}
        <button
          onClick={onOpenChat}
          className="relative flex flex-col items-center justify-center py-1 transition-all cursor-pointer text-teal-400 hover:text-teal-300 font-bold"
          title="Otvori interni LiveChat"
        >
          {unreadChatCount > 0 && (
            <span className="absolute -top-0.5 right-1.5 min-w-[16px] h-4 px-0.5 bg-rose-600 text-white text-[9px] font-black rounded-full flex items-center justify-center border border-slate-950 shadow-md animate-pulse">
              {unreadChatCount > 9 ? '9+' : unreadChatCount}
            </span>
          )}
          <MessageSquare className="w-4.5 h-4.5 mb-0.5 text-teal-300" />
          <span className="text-[9.5px] leading-tight text-teal-200">Chat</span>
        </button>

      </div>
    </nav>
  );
};
