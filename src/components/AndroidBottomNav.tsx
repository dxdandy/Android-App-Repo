import React from 'react';
import { 
  Waves, 
  Sparkles, 
  Scale, 
  LayoutDashboard
} from 'lucide-react';

interface AndroidBottomNavProps {
  activeTab: 'sve' | 'aljmas' | 'bogojevo' | 'solunar' | 'usporedba';
  onSelectTab: (tab: 'sve' | 'aljmas' | 'bogojevo' | 'solunar' | 'usporedba') => void;
}

export const AndroidBottomNav: React.FC<AndroidBottomNavProps> = ({
  activeTab,
  onSelectTab
}) => {
  return (
    <nav 
      aria-label="Mobilna navigacija"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 text-white shadow-xl px-1 py-1.5 pb-safe w-full max-w-full overflow-hidden"
    >
      <div className="grid grid-cols-5 items-center text-center w-full">
        
        {/* Pregled svega */}
        <button
          onClick={() => onSelectTab('sve')}
          className={`flex flex-col items-center justify-center py-1 transition-all cursor-pointer ${
            activeTab === 'sve' ? 'text-cyan-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <LayoutDashboard className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] leading-tight">Sve</span>
        </button>

        {/* Aljmaš */}
        <button
          onClick={() => onSelectTab('aljmas')}
          className={`flex flex-col items-center justify-center py-1 transition-all cursor-pointer ${
            activeTab === 'aljmas' ? 'text-teal-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Waves className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] leading-tight">Aljmaš</span>
        </button>

        {/* Bogojevo */}
        <button
          onClick={() => onSelectTab('bogojevo')}
          className={`flex flex-col items-center justify-center py-1 transition-all cursor-pointer ${
            activeTab === 'bogojevo' ? 'text-cyan-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Waves className="w-5 h-5 mb-0.5 text-cyan-300" />
          <span className="text-[10px] leading-tight">Bogojevo</span>
        </button>

        {/* Solunar */}
        <button
          onClick={() => onSelectTab('solunar')}
          className={`flex flex-col items-center justify-center py-1 transition-all cursor-pointer ${
            activeTab === 'solunar' ? 'text-indigo-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] leading-tight">Solunar</span>
        </button>

        {/* Usporedba */}
        <button
          onClick={() => onSelectTab('usporedba')}
          className={`flex flex-col items-center justify-center py-1 transition-all cursor-pointer ${
            activeTab === 'usporedba' ? 'text-purple-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Scale className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] leading-tight">Usporedi</span>
        </button>

      </div>
    </nav>
  );
};
