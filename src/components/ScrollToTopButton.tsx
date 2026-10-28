import React from 'react';
import { ArrowUp } from 'lucide-react';

interface ScrollToTopButtonProps {
  theme?: 'teal' | 'cyan' | 'indigo' | 'purple';
  className?: string;
}

/**
 * Varijanta 2: Minimalistička, uokvirena strelica za povratak na vrh stranice.
 * Postavlja se na kraju desno u prvom redu svakog poglavlja.
 */
export const ScrollToTopButton: React.FC<ScrollToTopButtonProps> = ({
  theme = 'cyan',
  className = ''
}) => {
  const handleScrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  // Teme prilagođene boji pojedinog poglavlja
  const themeStyles = {
    teal: 'bg-teal-950/70 border-teal-500/40 text-teal-300 hover:bg-teal-900/90 hover:border-teal-400 hover:text-white shadow-teal-950/30',
    cyan: 'bg-cyan-950/70 border-cyan-500/40 text-cyan-300 hover:bg-cyan-900/90 hover:border-cyan-400 hover:text-white shadow-cyan-950/30',
    indigo: 'bg-indigo-950/70 border-indigo-500/40 text-indigo-300 hover:bg-indigo-900/90 hover:border-indigo-400 hover:text-white shadow-indigo-950/30',
    purple: 'bg-purple-950/70 border-purple-500/40 text-purple-300 hover:bg-purple-900/90 hover:border-purple-400 hover:text-white shadow-purple-950/30'
  }[theme];

  return (
    <button
      type="button"
      onClick={handleScrollToTop}
      title="Povratak na početak stranice (vrh aplikacije)"
      aria-label="Povratak na vrh aplikacije"
      className={`p-1.5 sm:p-2 border rounded-xl shadow-xs transition-all duration-200 cursor-pointer active:scale-90 shrink-0 select-none group flex items-center justify-center ${themeStyles} ${className}`}
    >
      <ArrowUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:-translate-y-0.5 transition-transform duration-200" />
    </button>
  );
};
