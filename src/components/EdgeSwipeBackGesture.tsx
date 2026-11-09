import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { App as CapApp } from '@capacitor/app';

interface EdgeSwipeBackGestureProps {
  /**
   * Da li je trenutno otvoren bilo koji odjeljak ili modal (LiveChat, Ulovi, Lovostaj, Pro mod, Admin...)
   */
  isActive: boolean;
  /**
   * Funkcija koja se poziva za povratak unatrag (identično kliku na 'X' ili povratku na Osnovni mod)
   */
  onBack: () => void;
  /**
   * Naziv trenutno otvorenog odjeljka za diskretnu oznaku na gesti (npr. "Osnovni mod")
   */
  targetLabel?: string;
}

export const EdgeSwipeBackGesture: React.FC<EdgeSwipeBackGestureProps> = ({
  isActive,
  onBack,
  targetLabel = 'Osnovni mod'
}) => {
  // Stanje prikaza indikatora geste uz rub ekrana
  const [gestureState, setGestureState] = useState<{
    edge: 'left' | 'right' | null;
    distance: number;
    thresholdReached: boolean;
    touchY: number;
  }>({
    edge: null,
    distance: 0,
    thresholdReached: false,
    touchY: 0
  });

  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;

  // 1. HARDVERI / SISTEMSKI GUMB UNATRAG I SISTEMSKA STRELICA NA MOBITELU (Capacitor App backButton)
  useEffect(() => {
    let removeListener: (() => void) | null = null;

    try {
      const listenerPromise = CapApp.addListener('backButton', () => {
        if (isActiveRef.current) {
          // Ako je otvoren LiveChat, Evidencija ulova, Lovostaj, Pro mod ili bilo koji modal:
          // presretni hardverski gumb / strelicu i vrati korisnika u Osnovni mod!
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            try { navigator.vibrate(15); } catch {}
          }
          onBackRef.current();
        } else {
          // Ako je korisnik već u Osnovnom modu i nema otvorenih modala, minimiziraj aplikaciju
          try {
            CapApp.minimizeApp();
          } catch {}
        }
      });

      listenerPromise.then(handle => {
        removeListener = () => handle.remove();
      }).catch(() => {});
    } catch (err) {
      console.warn('Capacitor backButton listener nije podržan u ovom okruženju:', err);
    }

    // 2. PODRŠKA ZA BROWSER POPSTATE / POVRATAK U WEB PREGLEDNIKU NA MOBITELU
    const handlePopState = () => {
      if (isActiveRef.current) {
        onBackRef.current();
      }
    };
    window.addEventListener('popstate', handlePopState);

    return () => {
      if (removeListener) removeListener();
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // 3. GESTE PRSTOM S LIJEVOG ILI DESNOG RUBA EKRANA PREMA CENTRU (Edge Swipe Gesture)
  const touchStartRef = useRef<{
    x: number;
    y: number;
    edge: 'left' | 'right' | null;
    startTime: number;
    hasVibrated: boolean;
  }>({
    x: 0,
    y: 0,
    edge: null,
    startTime: 0,
    hasVibrated: false
  });

  const EDGE_ZONE_WIDTH = 45; // Širina zone uz rub ekrana u px (lijevi 0-45px, desni (width-45)-width)
  const TRIGGER_DISTANCE = 55; // Potreban pomak prstom prema centru ekrana za aktivaciju povratka

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!isActiveRef.current) return;
    if (e.touches.length !== 1) return;

    const touch = e.touches[0];
    const clientX = touch.clientX;
    const clientY = touch.clientY;
    const screenWidth = window.innerWidth;

    let edge: 'left' | 'right' | null = null;
    if (clientX <= EDGE_ZONE_WIDTH) {
      edge = 'left';
    } else if (clientX >= screenWidth - EDGE_ZONE_WIDTH) {
      edge = 'right';
    }

    if (edge) {
      touchStartRef.current = {
        x: clientX,
        y: clientY,
        edge,
        startTime: Date.now(),
        hasVibrated: false
      };
    } else {
      touchStartRef.current.edge = null;
    }
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isActiveRef.current || !touchStartRef.current.edge) return;
    if (e.touches.length !== 1) return;

    const touch = e.touches[0];
    const currentX = touch.clientX;
    const currentY = touch.clientY;
    const start = touchStartRef.current;

    const deltaX = currentX - start.x;
    const deltaY = currentY - start.y;

    // Provjeri je li pokret dominantno vodoravan (gesta prema centru)
    if (Math.abs(deltaY) > Math.abs(deltaX) * 1.25) {
      // Ako korisnik dominantno lista gore/dolje, prekini gestu povratka
      if (gestureState.edge) {
        setGestureState({ edge: null, distance: 0, thresholdReached: false, touchY: 0 });
      }
      return;
    }

    // Izračunaj pomak prema centru
    let distance = 0;
    if (start.edge === 'left' && deltaX > 0) {
      distance = deltaX;
    } else if (start.edge === 'right' && deltaX < 0) {
      distance = Math.abs(deltaX);
    }

    if (distance > 8) {
      const thresholdReached = distance >= TRIGGER_DISTANCE;

      if (thresholdReached && !start.hasVibrated) {
        start.hasVibrated = true;
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try { navigator.vibrate(12); } catch {}
        }
      } else if (!thresholdReached && start.hasVibrated) {
        start.hasVibrated = false;
      }

      setGestureState({
        edge: start.edge,
        distance,
        thresholdReached,
        touchY: currentY
      });
    }
  }, [gestureState.edge]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    const start = touchStartRef.current;
    if (!isActiveRef.current || !start.edge) {
      setGestureState({ edge: null, distance: 0, thresholdReached: false, touchY: 0 });
      return;
    }

    const changedTouch = e.changedTouches[0];
    if (changedTouch) {
      const deltaX = changedTouch.clientX - start.x;
      const deltaY = changedTouch.clientY - start.y;
      const duration = Date.now() - start.startTime;

      let distance = 0;
      if (start.edge === 'left') {
        distance = deltaX;
      } else if (start.edge === 'right') {
        distance = -deltaX;
      }

      // Uvjet za povratak: ili prijeđen prag (55px) ili brzi swipe trzaj (flick) prema centru (>35px unutar 260ms)
      const isFlick = distance >= 35 && duration < 260 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2;
      const reachedThreshold = distance >= TRIGGER_DISTANCE || isFlick;

      if (reachedThreshold) {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try { navigator.vibrate(20); } catch {}
        }
        onBackRef.current();
      }
    }

    touchStartRef.current.edge = null;
    setGestureState({ edge: null, distance: 0, thresholdReached: false, touchY: 0 });
  }, []);

  const handleTouchCancel = useCallback(() => {
    touchStartRef.current.edge = null;
    setGestureState({ edge: null, distance: 0, thresholdReached: false, touchY: 0 });
  }, []);

  useEffect(() => {
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, handleTouchCancel]);

  if (!gestureState.edge || gestureState.distance <= 10) {
    return null;
  }

  // Vizualni prikaz indikatora geste uz rub ekrana (poput modernog Android/iOS back prikaza)
  const isLeft = gestureState.edge === 'left';
  const progress = Math.min(gestureState.distance / TRIGGER_DISTANCE, 1.4);
  const offsetPx = Math.min(gestureState.distance * 0.45, 48);

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
      {/* Plivajući indikator strelice uz rub prsta */}
      <div
        className={`absolute flex items-center gap-1.5 transition-transform duration-75 ease-out select-none ${
          isLeft ? 'left-0 pl-1.5' : 'right-0 pr-1.5 flex-row-reverse'
        }`}
        style={{
          top: Math.max(70, Math.min(window.innerHeight - 80, gestureState.touchY - 28)),
          transform: `translateX(${isLeft ? offsetPx : -offsetPx}px)`
        }}
      >
        <div
          className={`flex items-center justify-center rounded-full shadow-2xl backdrop-blur-md transition-all duration-150 ${
            gestureState.thresholdReached
              ? 'w-12 h-12 bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-950 scale-110 shadow-cyan-500/50 ring-2 ring-white/80'
              : 'w-10 h-10 bg-slate-900/90 text-teal-300 border border-teal-500/50 shadow-black/80'
          }`}
        >
          {isLeft ? (
            <ChevronLeft
              className={`transition-transform ${
                gestureState.thresholdReached ? 'w-6 h-6 stroke-[3]' : 'w-5 h-5 stroke-[2.5]'
              }`}
            />
          ) : (
            <ChevronRight
              className={`transition-transform ${
                gestureState.thresholdReached ? 'w-6 h-6 stroke-[3]' : 'w-5 h-5 stroke-[2.5]'
              }`}
            />
          )}
        </div>

        {/* Diskretna oznaka odredišta ("Osnovni mod") koja se pojavi kad korisnik dosegne prag */}
        {gestureState.thresholdReached && (
          <div className="bg-slate-900/95 text-teal-300 text-[11px] font-black px-2.5 py-1 rounded-full border border-teal-500/40 shadow-lg tracking-wide whitespace-nowrap animate-fade-in flex items-center gap-1">
            <span>⚡ {targetLabel}</span>
          </div>
        )}
      </div>

      {/* Lagani rubni sjaj duž ekrana */}
      <div
        className={`absolute top-0 bottom-0 w-3 transition-opacity duration-150 ${
          isLeft ? 'left-0 bg-gradient-to-r' : 'right-0 bg-gradient-to-l'
        } from-teal-500/30 to-transparent`}
        style={{ opacity: Math.min(progress, 1) }}
      />
    </div>
  );
};
