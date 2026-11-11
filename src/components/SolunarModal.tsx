import React, { useEffect } from 'react';
import { X, Sparkles, Calendar, ChevronLeft } from 'lucide-react';
import { SolunarDayData } from '../types/fishing';
import { SolunarDailyDashboard } from './SolunarDailyDashboard';

interface SolunarModalProps {
  isOpen: boolean;
  onClose: () => void;
  solunar: SolunarDayData;
  isLoading: boolean;
}

export const SolunarModal: React.FC<SolunarModalProps> = ({
  isOpen,
  onClose,
  solunar,
  isLoading
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="w-full sm:max-w-4xl max-h-[92vh] sm:max-h-[88vh] bg-slate-900 border-t sm:border border-indigo-500/40 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Zaglavlje modala */}
        <div className="sticky top-0 z-10 bg-slate-900/98 backdrop-blur-md border-b border-indigo-500/30 px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-xl shrink-0 shadow-inner">
              🌙
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight truncate">
                  Dnevni Solunar Dunava
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  {solunar.overallScore}/5★
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-indigo-300 font-mono">
                <Calendar className="w-3 h-3 text-indigo-400 shrink-0" />
                <span>{solunar.formattedDate}</span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-300 font-sans">{solunar.ratingText} ({solunar.activityPercentage}%)</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer border border-slate-700 shrink-0 active:scale-95"
            title="Zatvori Solunar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tijelo modala sa SolunarDailyDashboard sadržajem */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-5 space-y-4">
          <SolunarDailyDashboard solunar={solunar} isLoading={isLoading} />
        </div>

        {/* Donja mobilna traka za zatvaranje */}
        <div className="p-3 bg-slate-900 border-t border-slate-800 text-center">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-200 hover:text-white font-bold text-xs transition-all border border-indigo-500/30 cursor-pointer active:scale-95 flex items-center justify-center gap-1.5 mx-auto"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Povratak na Osnovni mod</span>
          </button>
        </div>
      </div>
    </div>
  );
};
