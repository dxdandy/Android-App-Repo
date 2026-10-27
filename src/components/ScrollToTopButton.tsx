import React, { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

export type ScrollButtonVariant = 'text' | 'icon';

interface ScrollToTopButtonProps {
  theme?: 'teal' | 'cyan' | 'indigo';
  /** Ako se proslijedi, forsira određenu varijantu; inače čita iz postavki */
  variant?: ScrollButtonVariant;
  className?: string;
}

export const ScrollToTopButton: React.FC<ScrollToTopButtonProps> = ({
  theme = 'cyan',
  variant: forcedVariant,
  className = ''
}) => {
  const [activeVariant, setActiveVariant] = useState<ScrollButtonVariant>('text');

  useEffect(() => {
    if (forcedVariant) {
      setActiveVariant(forcedVariant);
      return;
    }
    const saved = localStorage.getItem('ribo_scroll_btn_variant') as ScrollButtonVariant;
    if (saved === 'icon' || saved === 'text') {
      setActiveVariant(saved);
    }

    const handleStorageChange = () => {
      const updated = localStorage.getItem('ribo_scroll_btn_variant') as ScrollButtonVariant;
      if (updated === 'icon' || updated === 'text') {
        setActiveVariant(updated);
      }
    };

    window.addEventListener('ribo_scroll_btn_change', handleStorageChange);
    return () => window.removeEventListener('ribo_scroll_btn_change', handleStorageChange);
  }, [forcedVariant]);

  const handleScrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  // Teme prilagođene boji pojedinog poglavlja
  const themeStyles = {
    teal: 'bg-teal-950/70 border-teal-500/40 text-teal-300 hover:bg-teal-900/80 hover:border-teal-400 hover:text-white shadow-teal-950/30',
    cyan: 'bg-cyan-950/70 border-cyan-500/40 text-cyan-300 hover:bg-cyan-900/80 hover:border-cyan-400 hover:text-white shadow-cyan-950/30',
    indigo: 'bg-indigo-950/70 border-indigo-500/40 text-indigo-300 hover:bg-indigo-900/80 hover:border-indigo-400 hover:text-white shadow-indigo-950/30'
  }[theme];

  return (
    <button
      type="button"
      onClick={handleScrollToTop}
      title="Povratak na početak stranice (vrh aplikacije)"
      aria-label="Povratak na vrh aplikacije"
      className={`border rounded-xl shadow-xs transition-all duration-200 cursor-pointer active:scale-95 shrink-0 select-none group flex items-center justify-center ${themeStyles} ${
        activeVariant === 'text' 
          ? 'px-2.5 py-1 gap-1.5' 
          : 'p-1.5 sm:p-2'
      } ${className}`}
    >
      <ArrowUp className="w-3.5 h-3.5 group-hover:-translate-y-0.5 transition-transform duration-200" />
      {activeVariant === 'text' && (
        <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider leading-none">
          Na vrh
        </span>
      )}
    </button>
  );
};

/**
 * Pomoćna funkcija za promjenu varijante gumba kroz aplikaciju
 */
export function setScrollButtonVariant(variant: ScrollButtonVariant) {
  localStorage.setItem('ribo_scroll_btn_variant', variant);
  window.dispatchEvent(new Event('ribo_scroll_btn_change'));
}

export function getScrollButtonVariant(): ScrollButtonVariant {
  if (typeof window === 'undefined') return 'text';
  const saved = localStorage.getItem('ribo_scroll_btn_variant');
  return (saved === 'icon' || saved === 'text') ? saved : 'text';
}
