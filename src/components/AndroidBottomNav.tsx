import React from 'react';
import { 
  Waves, 
  Sparkles, 
  Scale, 
  LayoutDashboard,
  MessageSquare
} from 'lucide-react';

interface AndroidBottomNavProps {
  activeTab: 'sve' | 'aljmas' | 'bogojevo' | 'solunar' | 'usporedba';
  onSelectTab: (tab: 'sve' | 'aljmas' | 'bogojevo' | 'solunar' | 'usporedba') => void;
  onOpenChat: () => void;
  unreadChatCount?: number;
}

export const AndroidBottomNav: React.FC<AndroidBottomNavProps> = ({
  activeTab,
  onSelectTab,
  onOpenChat,
  unreadChatCount = 0
}) => {
  return (
    <nav 
      aria-label="Mobilna navigacija"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 text-white shadow-xl px-1 py-1 pb-safe w-full max-w-full overflow-hidden"
    >
      <div className="grid grid-cols-6 items-center text-center w-full">
        
        {/* Pregled svega */}
        <button
          onClick={() => onSelectTab('sve')}
          className={`flex flex-col items-center justify-center py-1 transition-all cursor-pointer ${
            activeTab === 'sve' ? 'text-cyan-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <LayoutDashboard className="w-4.5 h-4.5 mb-0.5" />
          <span className="text-[9px] leading-tight font-medium">Sve</span>
        </button>

        {/* Aljmaš */}
        <button
          onClick={() => onSelectTab('aljmas')}
          className={`flex flex-col items-center justify-center py-1 transition-all cursor-pointer ${
            activeTab === 'aljmas' ? 'text-teal-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Waves className="w-4.5 h-4.5 mb-0.5" />
          <span className="text-[9px] leading-tight font-medium">Aljmaš</span>
        </button>

        {/* Bogojevo */}
        <button
          onClick={() => onSelectTab('bogojevo')}
          className={`flex flex-col items-center justify-center py-1 transition-all cursor-pointer ${
            activeTab === 'bogojevo' ? 'text-cyan-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Waves className="w-4.5 h-4.5 mb-0.5 text-cyan-300" />
          <span className="text-[9px] leading-tight font-medium">Bogojevo</span>
        </button>

        {/* Solunar */}
        <button
          onClick={() => onSelectTab('solunar')}
          className={`flex flex-col items-center justify-center py-1 transition-all cursor-pointer ${
            activeTab === 'solunar' ? 'text-indigo-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-4.5 h-4.5 mb-0.5" />
          <span className="text-[9px] leading-tight font-medium">Solunar</span>
        </button>

        {/* LiveChat - jasno istaknut s obavijestima za sve mobilne korisnike */}
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
          <span className="text-[9px] leading-tight text-teal-200">Chat</span>
        </button>

        {/* Usporedba */}
        <button
          onClick={() => onSelectTab('usporedba')}
          className={`flex flex-col items-center justify-center py-1 transition-all cursor-pointer ${
            activeTab === 'usporedba' ? 'text-purple-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Scale className="w-4.5 h-4.5 mb-0.5" />
          <span className="text-[9px] leading-tight font-medium">Usporedi</span>
        </button>

      </div>
    </nav>
  );
};
