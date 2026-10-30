import React, { useState, useEffect } from 'react';
import { 
  Waves, 
  Thermometer, 
  Gauge, 
  Wind, 
  Sunrise, 
  Flame, 
  Clock, 
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
  ArrowRight,
  Compass
} from 'lucide-react';
import { StationWaterData, SolunarDayData } from '../types/fishing';

interface BasicOverviewViewProps {
  aljmas: StationWaterData;
  bogojevo: StationWaterData;
  solunar: SolunarDayData;
  isLoading: boolean;
  onOpenExpertSection: (sectionId?: string) => void;
}

/**
 * Hook za pouzdanu detekciju orijentacije (vertikalno / horizontalno) u stvarnom vremenu.
 * Prepoznaje promjene rotacije mobilnog uređaja (orientationchange, resize, matchMedia).
 */
function useDeviceIsLandscape(): boolean {
  const [isLandscape, setIsLandscape] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const mediaLandscape = window.matchMedia('(orientation: landscape)').matches;
    const screenLandscape = Boolean(window.screen?.orientation?.type?.startsWith('landscape'));
    const dimensionsLandscape = window.innerWidth > window.innerHeight && window.innerWidth >= 520;
    return screenLandscape || mediaLandscape || dimensionsLandscape;
  });

  useEffect(() => {
    const handleOrientationChange = () => {
      const mediaLandscape = window.matchMedia('(orientation: landscape)').matches;
      const screenLandscape = Boolean(window.screen?.orientation?.type?.startsWith('landscape'));
      const dimensionsLandscape = window.innerWidth > window.innerHeight && window.innerWidth >= 520;
      setIsLandscape(screenLandscape || mediaLandscape || dimensionsLandscape);
    };

    handleOrientationChange();

    const mediaQuery = window.matchMedia('(orientation: landscape)');
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleOrientationChange);
    } else {
      mediaQuery.addListener(handleOrientationChange);
    }

    window.addEventListener('resize', handleOrientationChange);
    window.addEventListener('orientationchange', handleOrientationChange);
    if (window.screen?.orientation?.addEventListener) {
      window.screen.orientation.addEventListener('change', handleOrientationChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleOrientationChange);
      } else {
        mediaQuery.removeListener(handleOrientationChange);
      }
      window.removeEventListener('resize', handleOrientationChange);
      window.removeEventListener('orientationchange', handleOrientationChange);
      if (window.screen?.orientation?.removeEventListener) {
        window.screen.orientation.removeEventListener('change', handleOrientationChange);
      }
    };
  }, []);

  return isLandscape;
}

export const BasicOverviewView: React.FC<BasicOverviewViewProps> = ({
  aljmas,
  bogojevo,
  solunar,
  isLoading,
  onOpenExpertSection
}) => {
  const isLandscape = useDeviceIsLandscape();

  const getTrendIcon = (trend: string, sizeClass = 'w-3 h-3') => {
    switch (trend) {
      case 'u_porastu':
        return <TrendingUp className={`${sizeClass} text-emerald-400 shrink-0`} />;
      case 'opada':
        return <TrendingDown className={`${sizeClass} text-rose-400 shrink-0`} />;
      default:
        return <Minus className={`${sizeClass} text-amber-400 shrink-0`} />;
    }
  };

  const getMoonEmoji = (phase: string) => {
    switch (phase) {
      case 'pun_mjesec': return '🌕';
      case 'mladjak': return '🌑';
      case 'prva_cetvrt': return '🌓';
      case 'zadnja_cetvrt': return '🌗';
      case 'rastuci_srp': return '🌒';
      case 'opadajuci_srp': return '🌘';
      default: return '🌔';
    }
  };

  return (
    <div className="space-y-2.5 sm:space-y-3.5 animate-fadeIn">
      
      {/* 1. KARTICA: ALJMAŠ */}
      <div className="bg-slate-900/95 text-white rounded-xl sm:rounded-2xl p-2 sm:p-2.5 md:p-3 shadow-lg border border-teal-500/30 hover:border-teal-500/50 transition-all flex flex-row items-stretch gap-2 sm:gap-2.5 md:gap-3 relative overflow-hidden">
        <div className="absolute -left-10 -top-10 w-32 h-32 bg-teal-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* LIJEVI GUMB ALJMAŠ */}
        <button
          type="button"
          onClick={() => onOpenExpertSection('sekcija-aljmas')}
          className={`${
            isLandscape ? 'w-32 sm:w-36 md:w-44' : 'w-[92px] sm:w-32 md:w-36'
          } shrink-0 bg-gradient-to-br from-teal-950 via-slate-900 to-slate-900/95 border border-teal-500/50 hover:border-teal-400 active:scale-95 transition-all rounded-lg sm:rounded-xl p-2 sm:p-2.5 flex flex-col justify-between items-start text-left shadow-md group cursor-pointer`}
          title="Otvori detaljni Aljmaš u Ekspertnom modu"
        >
          <div className="w-full">
            <span className="font-black text-teal-300 group-hover:text-teal-200 text-xs sm:text-sm md:text-base tracking-wider uppercase block truncate">
              ALJMAŠ
            </span>
          </div>

          <div className="my-1">
            <div className={`${isLandscape ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl md:text-3xl'} font-black text-white font-mono tracking-tight leading-none`}>
              {aljmas.waterLevelCm} <span className="text-[10px] sm:text-xs font-bold text-teal-300">cm</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] sm:text-xs text-teal-300/90 font-medium mt-0.5 capitalize truncate">
              {getTrendIcon(aljmas.waterLevelTrend)}
              <span className="truncate">{aljmas.waterLevelTrend}</span>
            </div>
          </div>

          <div className="w-full pt-1 border-t border-teal-500/20 flex items-center justify-between text-[9px] sm:text-[10px] text-teal-400 font-medium">
            <span className="truncate">rkm 1380</span>
            <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform shrink-0" />
          </div>
        </button>

        {/* DESNA STRANA: DVIJE VARIJANTE PRIKAZA (HORIZONTALNO vs VERTIKALNO v1.2.1) */}
        {isLandscape ? (
          /* ========================================================
             HORIZONTALNI / LANDSCAPE PRIKAZ (2 REDA PO 3 PODATKA)
             Povećani fontovi, veće ikone, visina usklađena s gumbom
             ======================================================== */
          <div className="flex-1 min-w-0 grid grid-cols-3 gap-2 sm:gap-2.5 md:gap-3 content-stretch">
            
            {/* 1. Vodostaj & Promjena */}
            <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-2 sm:p-2.5 md:p-3 flex items-center gap-2 sm:gap-2.5 min-w-0 shadow-xs">
              <div className="p-1.5 sm:p-2 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20 shrink-0">
                <Waves className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] sm:text-xs text-slate-400 block uppercase font-bold leading-tight truncate">Vodostaj</span>
                <span className="text-xs sm:text-sm md:text-base font-black text-white block truncate leading-tight mt-0.5">
                  {aljmas.waterLevelCm} cm <span className="text-[10px] sm:text-xs text-teal-300 font-medium">({aljmas.waterLevelChangeCm >= 0 ? `+${aljmas.waterLevelChangeCm}` : aljmas.waterLevelChangeCm})</span>
                </span>
              </div>
            </div>

            {/* 2. Temperatura vode */}
            <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-2 sm:p-2.5 md:p-3 flex items-center gap-2 sm:gap-2.5 min-w-0 shadow-xs">
              <div className="p-1.5 sm:p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0">
                <Thermometer className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] sm:text-xs text-slate-400 block uppercase font-bold leading-tight truncate">Temp. vode</span>
                <span className="text-xs sm:text-sm md:text-base font-black text-cyan-300 block truncate leading-tight mt-0.5">
                  {aljmas.waterTempC} °C
                </span>
              </div>
            </div>

            {/* 3. Temperatura zraka */}
            <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-2 sm:p-2.5 md:p-3 flex items-center gap-2 sm:gap-2.5 min-w-0 shadow-xs">
              <div className="p-1.5 sm:p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                <Thermometer className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] sm:text-xs text-slate-400 block uppercase font-bold leading-tight truncate">Temp. zraka</span>
                <span className="text-xs sm:text-sm md:text-base font-black text-amber-300 block truncate leading-tight mt-0.5">
                  {aljmas.airTempC} °C
                </span>
              </div>
            </div>

            {/* 4. Tlak zraka */}
            <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-2 sm:p-2.5 md:p-3 flex items-center gap-2 sm:gap-2.5 min-w-0 shadow-xs">
              <div className="p-1.5 sm:p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
                <Gauge className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] sm:text-xs text-slate-400 block uppercase font-bold leading-tight truncate">Tlak zraka</span>
                <span className="text-xs sm:text-sm md:text-base font-black text-indigo-200 block truncate leading-tight mt-0.5">
                  {aljmas.airPressureHpa} hPa
                </span>
              </div>
            </div>

            {/* 5. Vjetar */}
            <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-2 sm:p-2.5 md:p-3 flex items-center gap-2 sm:gap-2.5 min-w-0 shadow-xs">
              <div className="p-1.5 sm:p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
                <Wind className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] sm:text-xs text-slate-400 block uppercase font-bold leading-tight truncate">Vjetar</span>
                <span className="text-xs sm:text-sm md:text-base font-black text-blue-300 block truncate leading-tight mt-0.5 whitespace-nowrap">
                  {aljmas.windSpeedMs ?? (aljmas.windSpeedKmh / 3.6).toFixed(1)} m/s {aljmas.windDirection}
                </span>
              </div>
            </div>

            {/* 6. Sunce */}
            <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-2 sm:p-2.5 md:p-3 flex items-center gap-2 sm:gap-2.5 min-w-0 shadow-xs">
              <div className="p-1.5 sm:p-2 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20 shrink-0">
                <Sunrise className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] sm:text-xs text-slate-400 block uppercase font-bold leading-tight truncate">Sunce</span>
                <span className="text-xs sm:text-sm md:text-base font-black text-orange-200 block font-mono leading-tight whitespace-nowrap mt-0.5">
                  {solunar.sunrise} - {solunar.sunset}
                </span>
              </div>
            </div>

          </div>
        ) : (
          /* ========================================================
             VERTIKALNI / PORTRAIT PRIKAZ (TOČNO KAO U VERZIJI 1.2.1)
             Kompaktno, optimalno za uske mobilne ekrane
             ======================================================== */
          <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-1 sm:gap-1.5 md:gap-2 content-center">
            
            {/* 1. Vodostaj & Promjena */}
            <div className="bg-slate-950/80 border border-slate-800/90 rounded-lg p-1.5 sm:p-2 flex items-center gap-1.5 min-w-0">
              <div className="p-1 sm:p-1.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20 shrink-0">
                <Waves className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[8.5px] sm:text-[9.5px] text-slate-400 block uppercase font-semibold leading-tight truncate">Vodostaj</span>
                <span className="text-[10.5px] sm:text-xs md:text-sm font-bold text-white block truncate leading-tight">
                  {aljmas.waterLevelCm} cm <span className="text-[8.5px] sm:text-[9.5px] text-teal-300 font-normal">({aljmas.waterLevelChangeCm >= 0 ? `+${aljmas.waterLevelChangeCm}` : aljmas.waterLevelChangeCm})</span>
                </span>
              </div>
            </div>

            {/* 2. Temperatura vode */}
            <div className="bg-slate-950/80 border border-slate-800/90 rounded-lg p-1.5 sm:p-2 flex items-center gap-1.5 min-w-0">
              <div className="p-1 sm:p-1.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0">
                <Thermometer className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[8.5px] sm:text-[9.5px] text-slate-400 block uppercase font-semibold leading-tight truncate">Temp. vode</span>
                <span className="text-[10.5px] sm:text-xs md:text-sm font-bold text-cyan-300 block truncate leading-tight">
                  {aljmas.waterTempC} °C
                </span>
              </div>
            </div>

            {/* 3. Temperatura zraka */}
            <div className="bg-slate-950/80 border border-slate-800/90 rounded-lg p-1.5 sm:p-2 flex items-center gap-1.5 min-w-0">
              <div className="p-1 sm:p-1.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                <Thermometer className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[8.5px] sm:text-[9.5px] text-slate-400 block uppercase font-semibold leading-tight truncate">Temp. zraka</span>
                <span className="text-[10.5px] sm:text-xs md:text-sm font-bold text-amber-300 block truncate leading-tight">
                  {aljmas.airTempC} °C
                </span>
              </div>
            </div>

            {/* 4. Tlak zraka */}
            <div className="bg-slate-950/80 border border-slate-800/90 rounded-lg p-1.5 sm:p-2 flex items-center gap-1.5 min-w-0">
              <div className="p-1 sm:p-1.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
                <Gauge className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[8.5px] sm:text-[9.5px] text-slate-400 block uppercase font-semibold leading-tight truncate">Tlak zraka</span>
                <span className="text-[10.5px] sm:text-xs md:text-sm font-bold text-indigo-200 block truncate leading-tight">
                  {aljmas.airPressureHpa} hPa
                </span>
              </div>
            </div>

            {/* 5. Vjetar */}
            <div className="bg-slate-950/80 border border-slate-800/90 rounded-lg p-1.5 sm:p-2 flex items-center gap-1.5 min-w-0">
              <div className="p-1 sm:p-1.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
                <Wind className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[8.5px] sm:text-[9.5px] text-slate-400 block uppercase font-semibold leading-tight truncate">Vjetar</span>
                <span className="text-[10px] sm:text-xs md:text-sm font-bold text-blue-300 block truncate leading-tight whitespace-nowrap">
                  {aljmas.windSpeedMs ?? (aljmas.windSpeedKmh / 3.6).toFixed(1)} m/s {aljmas.windDirection}
                </span>
              </div>
            </div>

            {/* 6. Izlazak / Zalazak Sunca (Font prilagođen da se vidi cijela satnica) */}
            <div className="bg-slate-950/80 border border-slate-800/90 rounded-lg p-1.5 sm:p-2 flex items-center gap-1.5 min-w-0">
              <div className="p-1 sm:p-1.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20 shrink-0">
                <Sunrise className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[8.5px] sm:text-[9.5px] text-slate-400 block uppercase font-semibold leading-tight truncate">Sunce</span>
                <span className="text-[9px] sm:text-[10.5px] md:text-xs font-bold text-orange-200 block font-mono leading-tight whitespace-nowrap">
                  {solunar.sunrise} - {solunar.sunset}
                </span>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* 2. KARTICA: BOGOJEVO */}
      <div className="bg-slate-900/95 text-white rounded-xl sm:rounded-2xl p-2 sm:p-2.5 md:p-3 shadow-lg border border-cyan-500/30 hover:border-cyan-500/50 transition-all flex flex-row items-stretch gap-2 sm:gap-2.5 md:gap-3 relative overflow-hidden">
        <div className="absolute -left-10 -top-10 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* LIJEVI GUMB BOGOJEVO */}
        <button
          type="button"
          onClick={() => onOpenExpertSection('sekcija-bogojevo')}
          className={`${
            isLandscape ? 'w-32 sm:w-36 md:w-44' : 'w-[92px] sm:w-32 md:w-36'
          } shrink-0 bg-gradient-to-br from-cyan-950 via-slate-900 to-slate-900/95 border border-cyan-500/50 hover:border-cyan-400 active:scale-95 transition-all rounded-lg sm:rounded-xl p-2 sm:p-2.5 flex flex-col justify-between items-start text-left shadow-md group cursor-pointer`}
          title="Otvori detaljno Bogojevo u Ekspertnom modu"
        >
          <div className="w-full">
            <span className="font-black text-cyan-300 group-hover:text-cyan-200 text-xs sm:text-sm md:text-base tracking-wider uppercase block truncate">
              BOGOJEVO
            </span>
          </div>

          <div className="my-1">
            <div className={`${isLandscape ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl md:text-3xl'} font-black text-white font-mono tracking-tight leading-none`}>
              {bogojevo.waterLevelCm} <span className="text-[10px] sm:text-xs font-bold text-cyan-300">cm</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] sm:text-xs text-cyan-300/90 font-medium mt-0.5 capitalize truncate">
              {getTrendIcon(bogojevo.waterLevelTrend)}
              <span className="truncate">{bogojevo.waterLevelTrend}</span>
            </div>
            <div className="text-[9.5px] sm:text-xs text-cyan-200 font-mono font-bold mt-0.5 truncate">
              {bogojevo.flowM3s || 985} (m3/s)
            </div>
          </div>

          <div className="w-full pt-1 border-t border-cyan-500/20 flex items-center justify-between text-[9px] sm:text-[10px] text-cyan-400 font-medium">
            <span className="truncate">rkm 1367</span>
            <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform shrink-0" />
          </div>
        </button>

        {/* DESNA STRANA: DVIJE VARIJANTE PRIKAZA (HORIZONTALNO vs VERTIKALNO v1.2.1) */}
        {isLandscape ? (
          /* ========================================================
             HORIZONTALNI / LANDSCAPE PRIKAZ (2 REDA PO 3 PODATKA)
             Povećani fontovi, veće ikone, visina usklađena s gumbom
             ======================================================== */
          <div className="flex-1 min-w-0 grid grid-cols-3 gap-2 sm:gap-2.5 md:gap-3 content-stretch">
            
            {/* 1. Vodostaj & Promjena */}
            <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-2 sm:p-2.5 md:p-3 flex items-center gap-2 sm:gap-2.5 min-w-0 shadow-xs">
              <div className="p-1.5 sm:p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0">
                <Waves className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] sm:text-xs text-slate-400 block uppercase font-bold leading-tight truncate">Vodostaj</span>
                <span className="text-xs sm:text-sm md:text-base font-black text-white block truncate leading-tight mt-0.5">
                  {bogojevo.waterLevelCm} cm <span className="text-[10px] sm:text-xs text-cyan-300 font-medium">({bogojevo.waterLevelChangeCm >= 0 ? `+${bogojevo.waterLevelChangeCm}` : bogojevo.waterLevelChangeCm})</span>
                </span>
              </div>
            </div>

            {/* 2. Temperatura vode */}
            <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-2 sm:p-2.5 md:p-3 flex items-center gap-2 sm:gap-2.5 min-w-0 shadow-xs">
              <div className="p-1.5 sm:p-2 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20 shrink-0">
                <Thermometer className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] sm:text-xs text-slate-400 block uppercase font-bold leading-tight truncate">Temp. vode</span>
                <span className="text-xs sm:text-sm md:text-base font-black text-teal-300 block truncate leading-tight mt-0.5">
                  {bogojevo.waterTempC} °C
                </span>
              </div>
            </div>

            {/* 3. Temperatura zraka */}
            <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-2 sm:p-2.5 md:p-3 flex items-center gap-2 sm:gap-2.5 min-w-0 shadow-xs">
              <div className="p-1.5 sm:p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                <Thermometer className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] sm:text-xs text-slate-400 block uppercase font-bold leading-tight truncate">Temp. zraka</span>
                <span className="text-xs sm:text-sm md:text-base font-black text-amber-300 block truncate leading-tight mt-0.5">
                  {bogojevo.airTempC} °C
                </span>
              </div>
            </div>

            {/* 4. Tlak zraka */}
            <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-2 sm:p-2.5 md:p-3 flex items-center gap-2 sm:gap-2.5 min-w-0 shadow-xs">
              <div className="p-1.5 sm:p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
                <Gauge className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] sm:text-xs text-slate-400 block uppercase font-bold leading-tight truncate">Tlak zraka</span>
                <span className="text-xs sm:text-sm md:text-base font-black text-indigo-200 block truncate leading-tight mt-0.5">
                  {bogojevo.airPressureHpa} hPa
                </span>
              </div>
            </div>

            {/* 5. Vjetar */}
            <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-2 sm:p-2.5 md:p-3 flex items-center gap-2 sm:gap-2.5 min-w-0 shadow-xs">
              <div className="p-1.5 sm:p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
                <Wind className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] sm:text-xs text-slate-400 block uppercase font-bold leading-tight truncate">Vjetar</span>
                <span className="text-xs sm:text-sm md:text-base font-black text-blue-300 block truncate leading-tight mt-0.5 whitespace-nowrap">
                  {bogojevo.windSpeedMs ?? (bogojevo.windSpeedKmh / 3.6).toFixed(1)} m/s {bogojevo.windDirection}
                </span>
              </div>
            </div>

            {/* 6. Sunce */}
            <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-2 sm:p-2.5 md:p-3 flex items-center gap-2 sm:gap-2.5 min-w-0 shadow-xs">
              <div className="p-1.5 sm:p-2 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20 shrink-0">
                <Sunrise className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] sm:text-xs text-slate-400 block uppercase font-bold leading-tight truncate">Sunce</span>
                <span className="text-xs sm:text-sm md:text-base font-black text-orange-200 block font-mono leading-tight whitespace-nowrap mt-0.5">
                  {solunar.sunrise} - {solunar.sunset}
                </span>
              </div>
            </div>

          </div>
        ) : (
          /* ========================================================
             VERTIKALNI / PORTRAIT PRIKAZ (TOČNO KAO U VERZIJI 1.2.1)
             Kompaktno, optimalno za uske mobilne ekrane
             ======================================================== */
          <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-1 sm:gap-1.5 md:gap-2 content-center">
            
            {/* 1. Vodostaj & Promjena */}
            <div className="bg-slate-950/80 border border-slate-800/90 rounded-lg p-1.5 sm:p-2 flex items-center gap-1.5 min-w-0">
              <div className="p-1 sm:p-1.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0">
                <Waves className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[8.5px] sm:text-[9.5px] text-slate-400 block uppercase font-semibold leading-tight truncate">Vodostaj</span>
                <span className="text-[10.5px] sm:text-xs md:text-sm font-bold text-white block truncate leading-tight">
                  {bogojevo.waterLevelCm} cm <span className="text-[8.5px] sm:text-[9.5px] text-cyan-300 font-normal">({bogojevo.waterLevelChangeCm >= 0 ? `+${bogojevo.waterLevelChangeCm}` : bogojevo.waterLevelChangeCm})</span>
                </span>
              </div>
            </div>

            {/* 2. Temperatura vode */}
            <div className="bg-slate-950/80 border border-slate-800/90 rounded-lg p-1.5 sm:p-2 flex items-center gap-1.5 min-w-0">
              <div className="p-1 sm:p-1.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20 shrink-0">
                <Thermometer className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[8.5px] sm:text-[9.5px] text-slate-400 block uppercase font-semibold leading-tight truncate">Temp. vode</span>
                <span className="text-[10.5px] sm:text-xs md:text-sm font-bold text-teal-300 block truncate leading-tight">
                  {bogojevo.waterTempC} °C
                </span>
              </div>
            </div>

            {/* 3. Temperatura zraka */}
            <div className="bg-slate-950/80 border border-slate-800/90 rounded-lg p-1.5 sm:p-2 flex items-center gap-1.5 min-w-0">
              <div className="p-1 sm:p-1.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                <Thermometer className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[8.5px] sm:text-[9.5px] text-slate-400 block uppercase font-semibold leading-tight truncate">Temp. zraka</span>
                <span className="text-[10.5px] sm:text-xs md:text-sm font-bold text-amber-300 block truncate leading-tight">
                  {bogojevo.airTempC} °C
                </span>
              </div>
            </div>

            {/* 4. Tlak zraka */}
            <div className="bg-slate-950/80 border border-slate-800/90 rounded-lg p-1.5 sm:p-2 flex items-center gap-1.5 min-w-0">
              <div className="p-1 sm:p-1.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
                <Gauge className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[8.5px] sm:text-[9.5px] text-slate-400 block uppercase font-semibold leading-tight truncate">Tlak zraka</span>
                <span className="text-[10.5px] sm:text-xs md:text-sm font-bold text-indigo-200 block truncate leading-tight">
                  {bogojevo.airPressureHpa} hPa
                </span>
              </div>
            </div>

            {/* 5. Vjetar */}
            <div className="bg-slate-950/80 border border-slate-800/90 rounded-lg p-1.5 sm:p-2 flex items-center gap-1.5 min-w-0">
              <div className="p-1 sm:p-1.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
                <Wind className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[8.5px] sm:text-[9.5px] text-slate-400 block uppercase font-semibold leading-tight truncate">Vjetar</span>
                <span className="text-[10px] sm:text-xs md:text-sm font-bold text-blue-300 block truncate leading-tight whitespace-nowrap">
                  {bogojevo.windSpeedMs ?? (bogojevo.windSpeedKmh / 3.6).toFixed(1)} m/s {bogojevo.windDirection}
                </span>
              </div>
            </div>

            {/* 6. Izlazak / Zalazak Sunca (Font prilagođen da se vidi cijela satnica) */}
            <div className="bg-slate-950/80 border border-slate-800/90 rounded-lg p-1.5 sm:p-2 flex items-center gap-1.5 min-w-0">
              <div className="p-1 sm:p-1.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20 shrink-0">
                <Sunrise className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[8.5px] sm:text-[9.5px] text-slate-400 block uppercase font-semibold leading-tight truncate">Sunce</span>
                <span className="text-[9px] sm:text-[10.5px] md:text-xs font-bold text-orange-200 block font-mono leading-tight whitespace-nowrap">
                  {solunar.sunrise} - {solunar.sunset}
                </span>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* 3. KARTICA: SOLUNAR */}
      <div className="bg-slate-900/95 text-white rounded-xl sm:rounded-2xl p-2 sm:p-2.5 md:p-3 shadow-lg border border-indigo-500/30 hover:border-indigo-500/50 transition-all flex flex-row items-stretch gap-2 sm:gap-2.5 md:gap-3 relative overflow-hidden">
        <div className="absolute -left-10 -top-10 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* LIJEVI GUMB SOLUNAR */}
        <button
          type="button"
          onClick={() => onOpenExpertSection('sekcija-solunar')}
          className={`${
            isLandscape ? 'w-32 sm:w-36 md:w-44' : 'w-[92px] sm:w-32 md:w-36'
          } shrink-0 bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-900/95 border border-indigo-500/50 hover:border-indigo-400 active:scale-95 transition-all rounded-lg sm:rounded-xl p-2 sm:p-2.5 flex flex-col justify-between items-start text-left shadow-md group cursor-pointer`}
          title="Otvori detaljni Solunarni centar u Ekspertnom modu"
        >
          <div className="w-full flex items-center justify-between">
            <span className="font-black text-indigo-300 group-hover:text-indigo-200 text-xs sm:text-sm md:text-base tracking-wider uppercase truncate">
              SOLUNAR
            </span>
            <span className="text-xs sm:text-sm shrink-0 ml-1">
              {getMoonEmoji(solunar.moonPhase)}
            </span>
          </div>

          <div className="my-1">
            <div className={`${isLandscape ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl md:text-3xl'} font-black text-amber-400 tracking-tight leading-none flex items-baseline gap-0.5`}>
              {solunar.overallScore}<span className="text-xs text-slate-400 font-bold">/5★</span>
            </div>
            <div className="text-[9.5px] sm:text-xs text-indigo-200 font-bold mt-0.5 truncate">
              {solunar.activityPercentage}% aktivnost
            </div>
          </div>

          <div className="w-full pt-1 border-t border-indigo-500/20 flex items-center justify-between text-[9px] sm:text-[10px] text-indigo-400 font-medium">
            <span className="truncate">{solunar.ratingText}</span>
            <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform shrink-0" />
          </div>
        </button>

        {/* DESNA STRANA: DVIJE VARIJANTE PRIKAZA (HORIZONTALNO vs VERTIKALNO v1.2.1) */}
        {isLandscape ? (
          /* ========================================================
             HORIZONTALNI / LANDSCAPE PRIKAZ (2 REDA PO 3 PODATKA)
             Povećani fontovi, veće ikone, visina usklađena s gumbom
             ======================================================== */
          <div className="flex-1 min-w-0 grid grid-cols-3 gap-2 sm:gap-2.5 md:gap-3 content-stretch">
            
            {/* 1. Mjesečeva mijena */}
            <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-2 sm:p-2.5 md:p-3 flex items-center gap-2 sm:gap-2.5 min-w-0 shadow-xs">
              <div className="p-1.5 sm:p-2 rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 shrink-0 text-sm">
                {getMoonEmoji(solunar.moonPhase)}
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] sm:text-xs text-slate-400 block uppercase font-bold leading-tight truncate">Faza Mjeseca</span>
                <span className="text-xs sm:text-sm md:text-base font-black text-white block leading-tight truncate mt-0.5" title={`${solunar.moonPhaseName} (${solunar.illuminationPct}%)`}>
                  {solunar.moonPhaseName} <span className="text-[10px] sm:text-xs text-indigo-300 font-medium">({solunar.illuminationPct}%)</span>
                </span>
              </div>
            </div>

            {/* 2. Glavni vrhunac 1 */}
            <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-2 sm:p-2.5 md:p-3 flex items-center gap-2 sm:gap-2.5 min-w-0 shadow-xs">
              <div className="p-1.5 sm:p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                <Flame className="w-4 h-4 sm:w-5 sm:h-5 fill-amber-400" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] sm:text-xs text-amber-300/90 block uppercase font-bold leading-tight truncate">
                  {solunar.major1.title || 'Vrhunac 1'}
                </span>
                <span className="text-xs sm:text-sm md:text-base font-mono font-black text-white block leading-tight whitespace-nowrap mt-0.5">
                  {solunar.major1.start} - {solunar.major1.end}
                </span>
              </div>
            </div>

            {/* 3. Glavni vrhunac 2 */}
            <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-2 sm:p-2.5 md:p-3 flex items-center gap-2 sm:gap-2.5 min-w-0 shadow-xs">
              <div className="p-1.5 sm:p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                <Flame className="w-4 h-4 sm:w-5 sm:h-5 fill-amber-400" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] sm:text-xs text-amber-300/90 block uppercase font-bold leading-tight truncate">
                  {solunar.major2.title || 'Vrhunac 2'}
                </span>
                <span className="text-xs sm:text-sm md:text-base font-mono font-black text-white block leading-tight whitespace-nowrap mt-0.5">
                  {solunar.major2.start} - {solunar.major2.end}
                </span>
              </div>
            </div>

            {/* 4. Sporedni impuls 1 */}
            <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-2 sm:p-2.5 md:p-3 flex items-center gap-2 sm:gap-2.5 min-w-0 shadow-xs">
              <div className="p-1.5 sm:p-2 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20 shrink-0">
                <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] sm:text-xs text-slate-400 block uppercase font-bold leading-tight truncate">
                  {solunar.minor1.title || 'Impuls 1'}
                </span>
                <span className="text-xs sm:text-sm md:text-base font-mono font-bold text-teal-200 block leading-tight whitespace-nowrap mt-0.5">
                  {solunar.minor1.start} - {solunar.minor1.end}
                </span>
              </div>
            </div>

            {/* 5. Sporedni impuls 2 */}
            <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-2 sm:p-2.5 md:p-3 flex items-center gap-2 sm:gap-2.5 min-w-0 shadow-xs">
              <div className="p-1.5 sm:p-2 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20 shrink-0">
                <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] sm:text-xs text-slate-400 block uppercase font-bold leading-tight truncate">
                  {solunar.minor2.title || 'Impuls 2'}
                </span>
                <span className="text-xs sm:text-sm md:text-base font-mono font-bold text-teal-200 block leading-tight whitespace-nowrap mt-0.5">
                  {solunar.minor2.start} - {solunar.minor2.end}
                </span>
              </div>
            </div>

            {/* 6. Mjesec (Izlaz - Zalaz) */}
            <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-2 sm:p-2.5 md:p-3 flex items-center gap-2 sm:gap-2.5 min-w-0 shadow-xs">
              <div className="p-1.5 sm:p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
                <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] sm:text-xs text-slate-400 block uppercase font-bold leading-tight truncate">Mjesec hod</span>
                <span className="text-xs sm:text-sm md:text-base font-mono font-bold text-indigo-200 block leading-tight whitespace-nowrap mt-0.5">
                  {solunar.moonrise} - {solunar.moonset}
                </span>
              </div>
            </div>

          </div>
        ) : (
          /* ========================================================
             VERTIKALNI / PORTRAIT PRIKAZ (TOČNO KAO U VERZIJI 1.2.1)
             Kompaktno, optimalno za uske mobilne ekrane
             ======================================================== */
          <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-1 sm:gap-1.5 md:gap-2 content-center">
            
            {/* 1. Mjesečeva mijena */}
            <div className="bg-slate-950/80 border border-slate-800/90 rounded-lg p-1.5 sm:p-2 flex items-center gap-1.5 min-w-0">
              <div className="p-1 sm:p-1.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 shrink-0 text-xs">
                {getMoonEmoji(solunar.moonPhase)}
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[8px] sm:text-[9px] text-slate-400 block uppercase font-semibold leading-tight truncate">Faza Mjeseca</span>
                <span className="text-[8.5px] sm:text-[10px] md:text-[11px] font-bold text-white block leading-tight truncate" title={`${solunar.moonPhaseName} (${solunar.illuminationPct}%)`}>
                  {solunar.moonPhaseName} <span className="text-[8px] sm:text-[9px] text-indigo-300 font-normal">({solunar.illuminationPct}%)</span>
                </span>
              </div>
            </div>

            {/* 2. Glavni vrhunac 1 */}
            <div className="bg-slate-950/80 border border-slate-800/90 rounded-lg p-1.5 sm:p-2 flex items-center gap-1.5 min-w-0">
              <div className="p-1 sm:p-1.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                <Flame className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-amber-400" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[8px] sm:text-[9px] text-amber-300/90 block uppercase font-bold leading-tight truncate">
                  {solunar.major1.title || 'Vrhunac 1'}
                </span>
                <span className="text-[8.5px] sm:text-[10px] md:text-[11.5px] font-mono font-black text-white block leading-tight whitespace-nowrap">
                  {solunar.major1.start} - {solunar.major1.end}
                </span>
              </div>
            </div>

            {/* 3. Glavni vrhunac 2 */}
            <div className="bg-slate-950/80 border border-slate-800/90 rounded-lg p-1.5 sm:p-2 flex items-center gap-1.5 min-w-0">
              <div className="p-1 sm:p-1.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                <Flame className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-amber-400" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[8px] sm:text-[9px] text-amber-300/90 block uppercase font-bold leading-tight truncate">
                  {solunar.major2.title || 'Vrhunac 2'}
                </span>
                <span className="text-[8.5px] sm:text-[10px] md:text-[11.5px] font-mono font-black text-white block leading-tight whitespace-nowrap">
                  {solunar.major2.start} - {solunar.major2.end}
                </span>
              </div>
            </div>

            {/* 4. Sporedni impuls 1 */}
            <div className="bg-slate-950/80 border border-slate-800/90 rounded-lg p-1.5 sm:p-2 flex items-center gap-1.5 min-w-0">
              <div className="p-1 sm:p-1.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20 shrink-0">
                <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[8px] sm:text-[9px] text-slate-400 block uppercase font-semibold leading-tight truncate">
                  {solunar.minor1.title || 'Impuls 1'}
                </span>
                <span className="text-[8.5px] sm:text-[10px] md:text-[11.5px] font-mono font-bold text-teal-200 block leading-tight whitespace-nowrap">
                  {solunar.minor1.start} - {solunar.minor1.end}
                </span>
              </div>
            </div>

            {/* 5. Sporedni impuls 2 */}
            <div className="bg-slate-950/80 border border-slate-800/90 rounded-lg p-1.5 sm:p-2 flex items-center gap-1.5 min-w-0">
              <div className="p-1 sm:p-1.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20 shrink-0">
                <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[8px] sm:text-[9px] text-slate-400 block uppercase font-semibold leading-tight truncate">
                  {solunar.minor2.title || 'Impuls 2'}
                </span>
                <span className="text-[8.5px] sm:text-[10px] md:text-[11.5px] font-mono font-bold text-teal-200 block leading-tight whitespace-nowrap">
                  {solunar.minor2.start} - {solunar.minor2.end}
                </span>
              </div>
            </div>

            {/* 6. Mjesec (Izlaz - Zalaz) */}
            <div className="bg-slate-950/80 border border-slate-800/90 rounded-lg p-1.5 sm:p-2 flex items-center gap-1.5 min-w-0">
              <div className="p-1 sm:p-1.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
                <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[8px] sm:text-[9px] text-slate-400 block uppercase font-semibold leading-tight truncate">Mjesec hod</span>
                <span className="text-[8.5px] sm:text-[10px] md:text-[11.5px] font-mono font-bold text-indigo-200 block leading-tight whitespace-nowrap">
                  {solunar.moonrise} - {solunar.moonset}
                </span>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* PODNOŽJE: Poziv na prelazak u Ekspertni Ribolovni Mod */}
      <div className="mt-4 sm:mt-6 p-3.5 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/90 to-slate-900 border border-indigo-500/40 shadow-xl flex flex-col md:flex-row items-center justify-between gap-3 sm:gap-4 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-full bg-gradient-to-l from-indigo-500/10 to-transparent pointer-events-none" />

        <div className="flex items-center gap-3 text-center md:text-left w-full md:w-auto">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-2xl shrink-0 shadow-inner">
            🎣
          </div>
          <div className="min-w-0 text-left">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base md:text-lg font-black text-white tracking-tight">
                Ekspertni Ribolovni Mod
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-gradient-to-r from-indigo-500 to-cyan-400 text-slate-950 shadow-xs">
                PRO NAČIN
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-300 mt-0.5 max-w-xl leading-snug">
              24-satna satna prognoza aktivnosti, taktički mamci za smuđa, soma i šarana, te hidrološki grafovi.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onOpenExpertSection()}
          className="w-full md:w-auto px-5 py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-indigo-500 via-cyan-400 to-teal-400 hover:from-indigo-400 hover:to-teal-300 text-slate-950 font-black text-xs sm:text-sm tracking-wide uppercase transition-all shadow-lg shadow-cyan-500/20 active:scale-95 flex items-center justify-center gap-2 shrink-0 cursor-pointer"
        >
          <span>Otvori Ekspertni Mod</span>
          <ArrowRight className="w-4 h-4 stroke-[2.5]" />
        </button>
      </div>

    </div>
  );
};
