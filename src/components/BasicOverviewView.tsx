import React, { useState, useEffect, useMemo } from 'react';
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
  Anchor,
  Bell,
  BellRing,
  Calendar,
  Droplets,
  Check,
  Trash2,
  Plus
} from 'lucide-react';
import { StationWaterData, SolunarDayData } from '../types/fishing';
import { getSolunarDataForDate } from '../services/weatherService';
import { showIncomingMessageNotification } from '../services/notificationService';
import { APP_FEATURES } from '../config/features';

export interface WaterAlertRule {
  id: string;
  station: 'aljmas' | 'bogojevo';
  metric: 'level' | 'temp';
  condition: 'above' | 'below';
  threshold: number;
  enabled: boolean;
  triggeredAt?: number;
}

const STORAGE_WATER_ALERTS_KEY = 'ribo_custom_water_alerts_v1';

export function loadWaterAlerts(): WaterAlertRule[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_WATER_ALERTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveWaterAlerts(alerts: WaterAlertRule[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_WATER_ALERTS_KEY, JSON.stringify(alerts));
  } catch {}
}

interface BasicOverviewViewProps {
  aljmas: StationWaterData;
  bogojevo: StationWaterData;
  solunar: SolunarDayData;
  isLoading: boolean;
  highContrast?: boolean;
  onOpenExpertSection: (sectionId?: string) => void;
  onOpenSolunar?: () => void;
  onOpenLovostaj?: () => void;
  onOpenCatchLog?: () => void;
}

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
  highContrast = false,
  onOpenExpertSection,
  onOpenSolunar,
  onOpenLovostaj,
  onOpenCatchLog
}) => {
  const isLandscape = useDeviceIsLandscape();

  // Stanja za osobne alarme vodostaja i temperature vode
  const [alerts, setAlerts] = useState<WaterAlertRule[]>(() => loadWaterAlerts());
  const [showAlertForm, setShowAlertForm] = useState<boolean>(false);
  const [newStation, setNewStation] = useState<'aljmas' | 'bogojevo'>('aljmas');
  const [newMetric, setNewMetric] = useState<'level' | 'temp'>('level');
  const [newCondition, setNewCondition] = useState<'above' | 'below'>('above');
  const [newThreshold, setNewThreshold] = useState<string>(() => String((aljmas.waterLevelCm || 0) + 20));
  const [triggeredBanner, setTriggeredBanner] = useState<string | null>(null);

  // Provjeri alarme svaki put kad se ažuriraju podaci za Aljmaš ili Bogojevo
  useEffect(() => {
    if (alerts.length === 0) return;
    let updatedAny = false;
    const now = Date.now();

    const nextAlerts = alerts.map(rule => {
      if (!rule.enabled) return rule;
      const stData = rule.station === 'aljmas' ? aljmas : bogojevo;
      const currentVal = rule.metric === 'level' ? stData.waterLevelCm : stData.waterTempC;
      const isMet =
        rule.condition === 'above'
          ? currentVal >= rule.threshold
          : currentVal <= rule.threshold;

      // Obavijesti najviše jednom u 6 sati za isti alarm
      if (isMet && (!rule.triggeredAt || now - rule.triggeredAt > 6 * 3600 * 1000)) {
        updatedAny = true;
        const stName = rule.station === 'aljmas' ? 'Aljmaš' : 'Bogojevo';
        const metricLabel = rule.metric === 'level' ? 'Vodostaj' : 'Temp. vode';
        const unit = rule.metric === 'level' ? 'cm' : '°C';
        const condText = rule.condition === 'above' ? 'prešao' : 'pao ispod';
        const msg = `${stName}: ${metricLabel} je ${condText} ${rule.threshold} ${unit} (trenutno: ${currentVal} ${unit})!`;
        setTriggeredBanner(msg);
        showIncomingMessageNotification('🔔 Alarm za Dunav', msg, `alarm_${rule.id}_${now}`);
        return { ...rule, triggeredAt: now };
      }
      return rule;
    });

    if (updatedAny) {
      setAlerts(nextAlerts);
      saveWaterAlerts(nextAlerts);
    }
  }, [aljmas, bogojevo, alerts]);

  const handleAddAlert = (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(newThreshold.replace(',', '.'));
    if (!Number.isFinite(val)) return;

    const rule: WaterAlertRule = {
      id: `al_${Date.now()}`,
      station: newStation,
      metric: newMetric,
      condition: newCondition,
      threshold: val,
      enabled: true
    };
    const updated = [rule, ...alerts].slice(0, 8);
    setAlerts(updated);
    saveWaterAlerts(updated);
    setShowAlertForm(false);
  };

  const handleRemoveAlert = (id: string) => {
    const updated = alerts.filter(a => a.id !== id);
    setAlerts(updated);
    saveWaterAlerts(updated);
  };

  // Taktički kalkulator protoka, zamućenosti i preporučene gramaže jig glave / olova (RiverApp stil)
  const tacticalRiverCalc = useMemo(() => {
    const flow = bogojevo.flowM3s || 1050;
    const change = aljmas.waterLevelChangeCm || 0;
    const level = aljmas.waterLevelCm || -70;

    // 1. Procjena zamućenosti / prozirnosti Dunava
    let clarityLabel = 'Dobra bistrina (45–70 cm)';
    let clarityColor = 'text-emerald-300';
    if (change >= 20 || flow > 3200) {
      clarityLabel = 'Mutna voda / Nosi naplavine (<20 cm)';
      clarityColor = 'text-rose-300';
    } else if (change >= 8 || flow > 2300) {
      clarityLabel = 'Blago zamućena u porastu (25–45 cm)';
      clarityColor = 'text-amber-300';
    } else if (change <= -5 && level < 50) {
      clarityLabel = 'Bistra voda u opadanju (60–90 cm)';
      clarityColor = 'text-cyan-300';
    }

    // 2. Preporučena gramaža jig glave (Obala/Šporanj vs Čamac/Matica)
    let shoreJig = '14 – 21 g';
    let boatJig = '21 – 30 g';
    let feederLead = '80 – 110 g';

    if (flow < 1300) {
      shoreJig = '10 – 18 g';
      boatJig = '18 – 28 g';
      feederLead = '60 – 90 g';
    } else if (flow <= 2200) {
      shoreJig = '14 – 24 g';
      boatJig = '25 – 35 g';
      feederLead = '90 – 120 g';
    } else if (flow <= 3200) {
      shoreJig = '21 – 32 g';
      boatJig = '35 – 50 g';
      feederLead = '120 – 160 g';
    } else {
      shoreJig = '28 – 45 g';
      boatJig = '45 – 70 g';
      feederLead = '150 – 200 g';
    }

    // 3. Preporuka pozicije ribe
    let spotAdvice = 'Prijelazi špornjeva i kontra-tokovi (dubina 4–7 m)';
    if (aljmas.waterTempC < 8) {
      spotAdvice = 'Zimovnici, duboke rupe iza špornja (7–12 m), usporena prezentacija';
    } else if (change > 5) {
      spotAdvice = 'Riba prilazi obali i plićim kamenim kosinama zbog porasta vode';
    }

    return {
      flow,
      clarityLabel,
      clarityColor,
      shoreJig,
      boatJig,
      feederLead,
      spotAdvice
    };
  }, [aljmas, bogojevo]);

  // 3-Dnevna ribolovna prognoza (Danas, Sutra, Prekosutra)
  const threeDayForecast = useMemo(() => {
    const baseWindMs = Number(aljmas.windSpeedMs ?? (aljmas.windSpeedKmh / 3.6).toFixed(1));
    const baseLevel = aljmas.waterLevelCm;
    const dailyStep = aljmas.waterLevelChangeCm;
    const bogForecasts = bogojevo.forecastDays || [];

    return [0, 1, 2].map(offset => {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + offset);
      const daySolunar = offset === 0
        ? solunar
        : getSolunarDataForDate(targetDate, aljmas.airPressureHpa || 1020, aljmas.airPressureTrend || 'stabilan');

      const dayLabel = offset === 0
        ? 'Danas'
        : offset === 1
        ? 'Sutra'
        : targetDate.toLocaleDateString('hr-HR', { weekday: 'short', day: '2-digit', month: '2-digit' });

      // Procijenjeni vodostaj
      const estAljmas = offset === 0 ? baseLevel : Math.round(baseLevel + dailyStep * offset * 0.8);
      const estBogojevo = offset === 0
        ? bogojevo.waterLevelCm
        : (bogForecasts[offset - 1] ?? Math.round(bogojevo.waterLevelCm + bogojevo.waterLevelChangeCm * offset * 0.8));

      // Vjetar i sigurnost za čamac
      const estWind = Number(Math.max(1.2, baseWindMs + (offset === 1 ? 0.4 : offset === 2 ? -0.3 : 0)).toFixed(1));
      const boatSafety = estWind <= 4.0
        ? { text: 'Mirno (Odlično za čamac)', color: 'text-emerald-300' }
        : estWind <= 6.5
        ? { text: 'Umjeren vjetar (Valovi)', color: 'text-amber-300' }
        : { text: 'Jak vjetar (Oprez na vodi!)', color: 'text-rose-300' };

      return {
        offset,
        dayLabel,
        estAljmas,
        estBogojevo,
        estWind,
        boatSafety,
        solunarScore: daySolunar.overallScore,
        activityPct: daySolunar.activityPercentage,
        major1: `${daySolunar.major1.start}-${daySolunar.major1.end}`,
        major2: `${daySolunar.major2.start}-${daySolunar.major2.end}`
      };
    });
  }, [aljmas, bogojevo, solunar]);

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

  const cardSurfaceClass = highContrast
    ? 'bg-slate-800/95 border-2 border-white/80 shadow-[0_0_18px_rgba(255,255,255,0.14)]'
    : 'bg-slate-900/95 shadow-lg';

  const cellSurfaceClass = highContrast
    ? 'bg-slate-900/95 border border-white/65 overflow-hidden'
    : 'bg-slate-950/85 border border-slate-800/90 overflow-hidden';

  const labelTextClass = highContrast
    ? 'text-[9.5px] sm:text-[10px] text-white font-bold uppercase leading-tight truncate'
    : 'text-[9.5px] sm:text-[10px] text-slate-300 font-bold uppercase leading-tight truncate';

  const formatTrendLabel = (trend: string) => (trend || '').replace(/_/g, ' ');

  return (
    <div className="space-y-2.5 sm:space-y-3.5 animate-fadeIn">
      
      {/* Obavijest ako se aktivirao osobni alarm za vodostaj/temperaturu */}
      {triggeredBanner && (
        <div className="p-3 rounded-2xl bg-amber-500/20 border-2 border-amber-400 text-amber-200 flex items-center justify-between gap-2 shadow-lg">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-black">
            <BellRing className="w-4 h-4 text-amber-300 shrink-0" />
            <span>{triggeredBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setTriggeredBanner(null)}
            className="px-2 py-0.5 rounded-lg bg-slate-900 text-amber-300 text-xs font-bold cursor-pointer"
          >
            OK
          </button>
        </div>
      )}

      {/* 1. KARTICA: ALJMAŠ */}
      <div className={`${cardSurfaceClass} text-white rounded-xl sm:rounded-2xl p-2 sm:p-2.5 md:p-3 border ${highContrast ? 'border-teal-300' : 'border-teal-500/35 hover:border-teal-500/50'} transition-all flex flex-row items-stretch gap-2 sm:gap-2.5 md:gap-3 relative overflow-hidden`}>
        {!highContrast && <div className="absolute -left-10 -top-10 w-32 h-32 bg-teal-500/10 rounded-full blur-2xl pointer-events-none" />}

        {/* LIJEVI GUMB ALJMAŠ */}
        <button
          type="button"
          onClick={() => {
            if (APP_FEATURES.ENABLE_PRO_MODE) onOpenExpertSection('sekcija-aljmas');
          }}
          className={`${
            isLandscape ? 'w-28 sm:w-34 md:w-42' : 'w-[96px] xs:w-[104px] sm:w-32 md:w-36'
          } shrink-0 bg-gradient-to-br from-teal-950 via-slate-900 to-slate-900/95 border border-teal-500/60 hover:border-teal-400 active:scale-95 transition-all rounded-lg sm:rounded-xl p-2 sm:p-2.5 flex flex-col justify-between items-start text-left shadow-md group ${APP_FEATURES.ENABLE_PRO_MODE ? 'cursor-pointer' : 'cursor-default'} overflow-hidden`}
          title={APP_FEATURES.ENABLE_PRO_MODE ? "Otvori detaljni Aljmaš u Pro modu" : "Službena hidrološka postaja Aljmaš (Dunav rkm 1380)"}
        >
          <div className="w-full min-w-0">
            <span className="font-black text-teal-300 group-hover:text-teal-200 text-[11.5px] sm:text-sm md:text-base tracking-tight uppercase block truncate">
              ALJMAŠ
            </span>
          </div>

          <div className="my-1 w-full min-w-0">
            <div className={`${isLandscape ? 'text-xl sm:text-2xl md:text-3xl' : 'text-lg sm:text-2xl md:text-3xl'} font-black text-white font-mono tracking-tight leading-none truncate`}>
              {aljmas.waterLevelCm} <span className="text-[10px] sm:text-xs font-bold text-teal-300">cm</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] sm:text-xs text-teal-200 font-bold mt-1 capitalize truncate">
              {getTrendIcon(aljmas.waterLevelTrend)}
              <span className="truncate">{formatTrendLabel(aljmas.waterLevelTrend)}</span>
            </div>
          </div>

          <div className="w-full pt-1 border-t border-teal-500/20 flex items-center justify-between text-[9.5px] sm:text-[10px] text-teal-300 font-bold">
            <span className="truncate">rkm 1380</span>
            {APP_FEATURES.ENABLE_PRO_MODE && (
              <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform shrink-0" />
            )}
          </div>
        </button>

        {/* DESNA STRANA ALJMAŠ */}
        {isLandscape ? (
          <div className="flex-1 min-w-0 grid grid-cols-3 gap-1.5 sm:gap-2 md:gap-2.5 content-stretch">
            <div className={`${cellSurfaceClass} rounded-xl p-1.5 sm:p-2 md:p-2.5 flex items-center gap-1.5 sm:gap-2 min-w-0 shadow-xs`}>
              <div className="p-1.5 rounded-lg bg-teal-500/15 text-teal-300 border border-teal-500/30 shrink-0">
                <Waves className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <span className={labelTextClass}>Vodostaj</span>
                <span className="text-xs sm:text-sm md:text-[15px] font-black text-white block truncate leading-tight tracking-tight mt-0.5">
                  {aljmas.waterLevelCm} cm <span className="text-[10px] sm:text-xs text-teal-300 font-bold">({aljmas.waterLevelChangeCm >= 0 ? `+${aljmas.waterLevelChangeCm}` : aljmas.waterLevelChangeCm})</span>
                </span>
              </div>
            </div>

            <div className={`${cellSurfaceClass} rounded-xl p-1.5 sm:p-2 md:p-2.5 flex items-center gap-1.5 sm:gap-2 min-w-0 shadow-xs`}>
              <div className="p-1.5 rounded-lg bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shrink-0">
                <Thermometer className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <span className={labelTextClass}>Temp. vode</span>
                <span className="text-xs sm:text-sm md:text-[15px] font-black text-cyan-200 block truncate leading-tight tracking-tight mt-0.5">
                  {aljmas.waterTempC} °C
                </span>
              </div>
            </div>

            <div className={`${cellSurfaceClass} rounded-xl p-1.5 sm:p-2 md:p-2.5 flex items-center gap-1.5 sm:gap-2 min-w-0 shadow-xs`}>
              <div className="p-1.5 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 shrink-0">
                <Thermometer className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <span className={labelTextClass}>Temp. zraka</span>
                <span className="text-xs sm:text-sm md:text-[15px] font-black text-amber-200 block truncate leading-tight tracking-tight mt-0.5">
                  {aljmas.airTempC} °C
                </span>
              </div>
            </div>

            <div className={`${cellSurfaceClass} rounded-xl p-1.5 sm:p-2 md:p-2.5 flex items-center gap-1.5 sm:gap-2 min-w-0 shadow-xs`}>
              <div className="p-1.5 rounded-lg bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 shrink-0">
                <Gauge className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <span className={labelTextClass}>Tlak zraka</span>
                <span className="text-xs sm:text-sm md:text-[15px] font-black text-indigo-200 block truncate leading-tight tracking-tight mt-0.5">
                  {aljmas.airPressureHpa} hPa
                </span>
              </div>
            </div>

            <div className={`${cellSurfaceClass} rounded-xl p-1.5 sm:p-2 md:p-2.5 flex items-center gap-1.5 sm:gap-2 min-w-0 shadow-xs`}>
              <div className="p-1.5 rounded-lg bg-blue-500/15 text-blue-300 border border-blue-500/30 shrink-0">
                <Wind className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <span className={labelTextClass}>Vjetar</span>
                <span className="text-xs sm:text-sm md:text-[15px] font-black text-blue-200 block truncate leading-tight tracking-tight mt-0.5">
                  {aljmas.windSpeedMs ?? (aljmas.windSpeedKmh / 3.6).toFixed(1)} m/s {aljmas.windDirection}
                </span>
              </div>
            </div>

            <div className={`${cellSurfaceClass} rounded-xl p-1.5 sm:p-2 md:p-2.5 flex items-center gap-1.5 sm:gap-2 min-w-0 shadow-xs`}>
              <div className="p-1.5 rounded-lg bg-orange-500/15 text-orange-300 border border-orange-500/30 shrink-0">
                <Sunrise className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <span className={labelTextClass}>Sunce</span>
                <span className="text-xs sm:text-sm md:text-[15px] font-black text-orange-200 block font-mono leading-tight tracking-tight truncate mt-0.5">
                  {solunar.sunrise} - {solunar.sunset}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-1.5 sm:gap-2 content-center">
            <div className={`${cellSurfaceClass} rounded-lg px-2 py-1.5 flex flex-col justify-center min-w-0`}>
              <div className="flex items-center gap-1 min-w-0">
                <Waves className="w-3 h-3 text-teal-400 shrink-0" />
                <span className={labelTextClass}>Vodostaj</span>
              </div>
              <span className="text-[11.5px] sm:text-xs font-black text-white block truncate leading-tight tracking-tight mt-0.5">
                {aljmas.waterLevelCm} cm <span className="text-[10px] text-teal-300 font-bold">({aljmas.waterLevelChangeCm >= 0 ? `+${aljmas.waterLevelChangeCm}` : aljmas.waterLevelChangeCm})</span>
              </span>
            </div>

            <div className={`${cellSurfaceClass} rounded-lg px-2 py-1.5 flex flex-col justify-center min-w-0`}>
              <div className="flex items-center gap-1 min-w-0">
                <Thermometer className="w-3 h-3 text-cyan-400 shrink-0" />
                <span className={labelTextClass}>Temp. vode</span>
              </div>
              <span className="text-xs sm:text-sm font-black text-cyan-200 block truncate leading-tight tracking-tight mt-0.5">
                {aljmas.waterTempC} °C
              </span>
            </div>

            <div className={`${cellSurfaceClass} rounded-lg px-2 py-1.5 flex flex-col justify-center min-w-0`}>
              <div className="flex items-center gap-1 min-w-0">
                <Thermometer className="w-3 h-3 text-amber-400 shrink-0" />
                <span className={labelTextClass}>Temp. zraka</span>
              </div>
              <span className="text-xs sm:text-sm font-black text-amber-200 block truncate leading-tight tracking-tight mt-0.5">
                {aljmas.airTempC} °C
              </span>
            </div>

            <div className={`${cellSurfaceClass} rounded-lg px-2 py-1.5 flex flex-col justify-center min-w-0`}>
              <div className="flex items-center gap-1 min-w-0">
                <Gauge className="w-3 h-3 text-indigo-400 shrink-0" />
                <span className={labelTextClass}>Tlak zraka</span>
              </div>
              <span className="text-xs sm:text-sm font-black text-indigo-200 block truncate leading-tight tracking-tight mt-0.5">
                {aljmas.airPressureHpa} hPa
              </span>
            </div>

            <div className={`${cellSurfaceClass} rounded-lg px-2 py-1.5 flex flex-col justify-center min-w-0`}>
              <div className="flex items-center gap-1 min-w-0">
                <Wind className="w-3 h-3 text-blue-400 shrink-0" />
                <span className={labelTextClass}>Vjetar</span>
              </div>
              <span className="text-[11.5px] sm:text-xs font-black text-blue-200 block truncate leading-tight tracking-tight mt-0.5">
                {aljmas.windSpeedMs ?? (aljmas.windSpeedKmh / 3.6).toFixed(1)} m/s {aljmas.windDirection}
              </span>
            </div>

            <div className={`${cellSurfaceClass} rounded-lg px-2 py-1.5 flex flex-col justify-center min-w-0`}>
              <div className="flex items-center gap-1 min-w-0">
                <Sunrise className="w-3 h-3 text-orange-400 shrink-0" />
                <span className={labelTextClass}>Sunce</span>
              </div>
              <span className="text-[11px] sm:text-xs font-black text-orange-200 block font-mono leading-tight tracking-tight truncate mt-0.5">
                {solunar.sunrise} - {solunar.sunset}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 2. KARTICA: BOGOJEVO */}
      <div className={`${cardSurfaceClass} text-white rounded-xl sm:rounded-2xl p-2 sm:p-2.5 md:p-3 border ${highContrast ? 'border-cyan-300' : 'border-cyan-500/35 hover:border-cyan-500/50'} transition-all flex flex-row items-stretch gap-2 sm:gap-2.5 md:gap-3 relative overflow-hidden`}>
        {!highContrast && <div className="absolute -left-10 -top-10 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />}

        <button
          type="button"
          onClick={() => {
            if (APP_FEATURES.ENABLE_PRO_MODE) onOpenExpertSection('sekcija-bogojevo');
          }}
          className={`${
            isLandscape ? 'w-28 sm:w-34 md:w-42' : 'w-[96px] xs:w-[104px] sm:w-32 md:w-36'
          } shrink-0 bg-gradient-to-br from-cyan-950 via-slate-900 to-slate-900/95 border border-cyan-500/60 hover:border-cyan-400 active:scale-95 transition-all rounded-lg sm:rounded-xl p-2 sm:p-2.5 flex flex-col justify-between items-start text-left shadow-md group ${APP_FEATURES.ENABLE_PRO_MODE ? 'cursor-pointer' : 'cursor-default'} overflow-hidden`}
          title={APP_FEATURES.ENABLE_PRO_MODE ? "Otvori detaljno Bogojevo u Pro modu" : "Službena hidrološka postaja Bogojevo (Dunav rkm 1367)"}
        >
          <div className="w-full min-w-0">
            <span className="font-black text-cyan-300 group-hover:text-cyan-200 text-[11px] sm:text-sm md:text-base tracking-tight uppercase block truncate">
              BOGOJEVO
            </span>
          </div>

          <div className="my-1 w-full min-w-0">
            <div className={`${isLandscape ? 'text-xl sm:text-2xl md:text-3xl' : 'text-lg sm:text-2xl md:text-3xl'} font-black text-white font-mono tracking-tight leading-none truncate`}>
              {bogojevo.waterLevelCm} <span className="text-[10px] sm:text-xs font-bold text-cyan-300">cm</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] sm:text-xs text-cyan-200 font-bold mt-0.5 capitalize truncate">
              {getTrendIcon(bogojevo.waterLevelTrend)}
              <span className="truncate">{formatTrendLabel(bogojevo.waterLevelTrend)}</span>
            </div>
            <div className="text-[10px] sm:text-xs text-cyan-200 font-mono font-bold mt-0.5 truncate">
              {bogojevo.flowM3s || 985} m³/s
            </div>
          </div>

          <div className="w-full pt-1 border-t border-cyan-500/20 flex items-center justify-between text-[9.5px] sm:text-[10px] text-cyan-300 font-bold">
            <span className="truncate">rkm 1367</span>
            {APP_FEATURES.ENABLE_PRO_MODE && (
              <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform shrink-0" />
            )}
          </div>
        </button>

        {isLandscape ? (
          <div className="flex-1 min-w-0 grid grid-cols-3 gap-1.5 sm:gap-2 md:gap-2.5 content-stretch">
            <div className={`${cellSurfaceClass} rounded-xl p-1.5 sm:p-2 md:p-2.5 flex items-center gap-1.5 sm:gap-2 min-w-0 shadow-xs`}>
              <div className="p-1.5 rounded-lg bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shrink-0">
                <Waves className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <span className={labelTextClass}>Vodostaj</span>
                <span className="text-xs sm:text-sm md:text-[15px] font-black text-white block truncate leading-tight tracking-tight mt-0.5">
                  {bogojevo.waterLevelCm} cm <span className="text-[10px] sm:text-xs text-cyan-300 font-bold">({bogojevo.waterLevelChangeCm >= 0 ? `+${bogojevo.waterLevelChangeCm}` : bogojevo.waterLevelChangeCm})</span>
                </span>
              </div>
            </div>

            <div className={`${cellSurfaceClass} rounded-xl p-1.5 sm:p-2 md:p-2.5 flex items-center gap-1.5 sm:gap-2 min-w-0 shadow-xs`}>
              <div className="p-1.5 rounded-lg bg-teal-500/15 text-teal-300 border border-teal-500/30 shrink-0">
                <Thermometer className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <span className={labelTextClass}>Temp. vode</span>
                <span className="text-xs sm:text-sm md:text-[15px] font-black text-teal-200 block truncate leading-tight tracking-tight mt-0.5">
                  {bogojevo.waterTempC} °C
                </span>
              </div>
            </div>

            <div className={`${cellSurfaceClass} rounded-xl p-1.5 sm:p-2 md:p-2.5 flex items-center gap-1.5 sm:gap-2 min-w-0 shadow-xs`}>
              <div className="p-1.5 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 shrink-0">
                <Thermometer className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <span className={labelTextClass}>Temp. zraka</span>
                <span className="text-xs sm:text-sm md:text-[15px] font-black text-amber-200 block truncate leading-tight tracking-tight mt-0.5">
                  {bogojevo.airTempC} °C
                </span>
              </div>
            </div>

            <div className={`${cellSurfaceClass} rounded-xl p-1.5 sm:p-2 md:p-2.5 flex items-center gap-1.5 sm:gap-2 min-w-0 shadow-xs`}>
              <div className="p-1.5 rounded-lg bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 shrink-0">
                <Gauge className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <span className={labelTextClass}>Tlak zraka</span>
                <span className="text-xs sm:text-sm md:text-[15px] font-black text-indigo-200 block truncate leading-tight tracking-tight mt-0.5">
                  {bogojevo.airPressureHpa} hPa
                </span>
              </div>
            </div>

            <div className={`${cellSurfaceClass} rounded-xl p-1.5 sm:p-2 md:p-2.5 flex items-center gap-1.5 sm:gap-2 min-w-0 shadow-xs`}>
              <div className="p-1.5 rounded-lg bg-blue-500/15 text-blue-300 border border-blue-500/30 shrink-0">
                <Wind className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <span className={labelTextClass}>Vjetar</span>
                <span className="text-xs sm:text-sm md:text-[15px] font-black text-blue-200 block truncate leading-tight tracking-tight mt-0.5">
                  {bogojevo.windSpeedMs ?? (bogojevo.windSpeedKmh / 3.6).toFixed(1)} m/s {bogojevo.windDirection}
                </span>
              </div>
            </div>

            <div className={`${cellSurfaceClass} rounded-xl p-1.5 sm:p-2 md:p-2.5 flex items-center gap-1.5 sm:gap-2 min-w-0 shadow-xs`}>
              <div className="p-1.5 rounded-lg bg-orange-500/15 text-orange-300 border border-orange-500/30 shrink-0">
                <Sunrise className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <span className={labelTextClass}>Sunce</span>
                <span className="text-xs sm:text-sm md:text-[15px] font-black text-orange-200 block font-mono leading-tight tracking-tight truncate mt-0.5">
                  {solunar.sunrise} - {solunar.sunset}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-1.5 sm:gap-2 content-center">
            <div className={`${cellSurfaceClass} rounded-lg px-2 py-1.5 flex flex-col justify-center min-w-0`}>
              <div className="flex items-center gap-1 min-w-0">
                <Waves className="w-3 h-3 text-cyan-400 shrink-0" />
                <span className={labelTextClass}>Vodostaj</span>
              </div>
              <span className="text-[11.5px] sm:text-xs font-black text-white block truncate leading-tight tracking-tight mt-0.5">
                {bogojevo.waterLevelCm} cm <span className="text-[10px] text-cyan-300 font-bold">({bogojevo.waterLevelChangeCm >= 0 ? `+${bogojevo.waterLevelChangeCm}` : bogojevo.waterLevelChangeCm})</span>
              </span>
            </div>

            <div className={`${cellSurfaceClass} rounded-lg px-2 py-1.5 flex flex-col justify-center min-w-0`}>
              <div className="flex items-center gap-1 min-w-0">
                <Thermometer className="w-3 h-3 text-teal-400 shrink-0" />
                <span className={labelTextClass}>Temp. vode</span>
              </div>
              <span className="text-xs sm:text-sm font-black text-teal-200 block truncate leading-tight tracking-tight mt-0.5">
                {bogojevo.waterTempC} °C
              </span>
            </div>

            <div className={`${cellSurfaceClass} rounded-lg px-2 py-1.5 flex flex-col justify-center min-w-0`}>
              <div className="flex items-center gap-1 min-w-0">
                <Thermometer className="w-3 h-3 text-amber-400 shrink-0" />
                <span className={labelTextClass}>Temp. zraka</span>
              </div>
              <span className="text-xs sm:text-sm font-black text-amber-200 block truncate leading-tight tracking-tight mt-0.5">
                {bogojevo.airTempC} °C
              </span>
            </div>

            <div className={`${cellSurfaceClass} rounded-lg px-2 py-1.5 flex flex-col justify-center min-w-0`}>
              <div className="flex items-center gap-1 min-w-0">
                <Gauge className="w-3 h-3 text-indigo-400 shrink-0" />
                <span className={labelTextClass}>Tlak zraka</span>
              </div>
              <span className="text-xs sm:text-sm font-black text-indigo-200 block truncate leading-tight tracking-tight mt-0.5">
                {bogojevo.airPressureHpa} hPa
              </span>
            </div>

            <div className={`${cellSurfaceClass} rounded-lg px-2 py-1.5 flex flex-col justify-center min-w-0`}>
              <div className="flex items-center gap-1 min-w-0">
                <Wind className="w-3 h-3 text-blue-400 shrink-0" />
                <span className={labelTextClass}>Vjetar</span>
              </div>
              <span className="text-[11.5px] sm:text-xs font-black text-blue-200 block truncate leading-tight tracking-tight mt-0.5">
                {bogojevo.windSpeedMs ?? (bogojevo.windSpeedKmh / 3.6).toFixed(1)} m/s {bogojevo.windDirection}
              </span>
            </div>

            <div className={`${cellSurfaceClass} rounded-lg px-2 py-1.5 flex flex-col justify-center min-w-0`}>
              <div className="flex items-center gap-1 min-w-0">
                <Sunrise className="w-3 h-3 text-orange-400 shrink-0" />
                <span className={labelTextClass}>Sunce</span>
              </div>
              <span className="text-[11px] sm:text-xs font-black text-orange-200 block font-mono leading-tight tracking-tight truncate mt-0.5">
                {solunar.sunrise} - {solunar.sunset}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 3. KARTICA: SOLUNAR */}
      <div className={`${cardSurfaceClass} text-white rounded-xl sm:rounded-2xl p-2 sm:p-2.5 md:p-3 border ${highContrast ? 'border-indigo-300' : 'border-indigo-500/35 hover:border-indigo-500/50'} transition-all flex flex-row items-stretch gap-2 sm:gap-2.5 md:gap-3 relative overflow-hidden`}>
        {!highContrast && <div className="absolute -left-10 -top-10 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />}

        <button
          type="button"
          onClick={() => {
            if (onOpenSolunar) onOpenSolunar();
            else onOpenExpertSection('sekcija-solunar');
          }}
          className={`${
            isLandscape ? 'w-28 sm:w-34 md:w-42' : 'w-[96px] xs:w-[104px] sm:w-32 md:w-36'
          } shrink-0 bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-900/95 border border-indigo-500/60 hover:border-indigo-400 active:scale-95 transition-all rounded-lg sm:rounded-xl p-2 sm:p-2.5 flex flex-col justify-between items-start text-left shadow-md group cursor-pointer overflow-hidden`}
          title="Otvori detaljni Dnevni Solunar i vrijeme griza"
        >
          <div className="w-full flex items-center justify-between min-w-0">
            <span className="font-black text-indigo-300 group-hover:text-indigo-200 text-[11px] sm:text-sm md:text-base tracking-tight uppercase truncate leading-none">
              SOLUNAR
            </span>
            <span className="text-xs sm:text-sm shrink-0 leading-none select-none pl-0.5" title={solunar.moonPhaseName}>
              {getMoonEmoji(solunar.moonPhase)}
            </span>
          </div>

          <div className="my-1 w-full min-w-0">
            <div className={`${isLandscape ? 'text-xl sm:text-2xl md:text-3xl' : 'text-lg sm:text-2xl md:text-3xl'} font-black text-amber-400 tracking-tight leading-none flex items-baseline gap-0.5`}>
              {solunar.overallScore}<span className="text-xs text-slate-300 font-bold">/5★</span>
            </div>
            <div className="text-[10px] sm:text-xs text-indigo-200 font-bold mt-1 truncate">
              {solunar.activityPercentage}% aktivnost
            </div>
          </div>

          <div className="w-full pt-1 border-t border-indigo-500/20 flex items-center justify-between text-[9.5px] sm:text-[10px] text-indigo-300 font-bold">
            <span className="truncate">{solunar.ratingText}</span>
            <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform shrink-0" />
          </div>
        </button>

        {isLandscape ? (
          <div className="flex-1 min-w-0 grid grid-cols-3 gap-1.5 sm:gap-2 md:gap-2.5 content-stretch">
            <div className={`${cellSurfaceClass} rounded-xl p-1.5 sm:p-2 md:p-2.5 flex items-center gap-1.5 sm:gap-2 min-w-0 shadow-xs`}>
              <div className="p-1.5 rounded-lg bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 shrink-0 text-sm leading-none">
                {getMoonEmoji(solunar.moonPhase)}
              </div>
              <div className="min-w-0 flex-1">
                <span className={labelTextClass}>Faza Mjeseca</span>
                <span className="text-xs sm:text-sm md:text-[15px] font-black text-white block leading-tight tracking-tight truncate mt-0.5">
                  {solunar.moonPhaseName} <span className="text-[10px] sm:text-xs text-indigo-300 font-bold">({solunar.illuminationPct}%)</span>
                </span>
              </div>
            </div>

            <div className={`${cellSurfaceClass} rounded-xl p-1.5 sm:p-2 md:p-2.5 flex items-center gap-1.5 sm:gap-2 min-w-0 shadow-xs`}>
              <div className="p-1.5 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0">
                <Flame className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-amber-400" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[9.5px] sm:text-[10.5px] text-amber-300 block uppercase font-black leading-tight truncate">
                  {solunar.major1.title || 'Vrhunac 1'}
                </span>
                <span className="text-xs sm:text-sm md:text-[15px] font-mono font-black text-white block leading-tight tracking-tight truncate mt-0.5">
                  {solunar.major1.start} - {solunar.major1.end}
                </span>
              </div>
            </div>

            <div className={`${cellSurfaceClass} rounded-xl p-1.5 sm:p-2 md:p-2.5 flex items-center gap-1.5 sm:gap-2 min-w-0 shadow-xs`}>
              <div className="p-1.5 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0">
                <Flame className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-amber-400" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[9.5px] sm:text-[10.5px] text-amber-300 block uppercase font-black leading-tight truncate">
                  {solunar.major2.title || 'Vrhunac 2'}
                </span>
                <span className="text-xs sm:text-sm md:text-[15px] font-mono font-black text-white block leading-tight tracking-tight truncate mt-0.5">
                  {solunar.major2.start} - {solunar.major2.end}
                </span>
              </div>
            </div>

            <div className={`${cellSurfaceClass} rounded-xl p-1.5 sm:p-2 md:p-2.5 flex items-center gap-1.5 sm:gap-2 min-w-0 shadow-xs`}>
              <div className="p-1.5 rounded-lg bg-teal-500/15 text-teal-300 border border-teal-500/30 shrink-0">
                <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <span className={labelTextClass}>{solunar.minor1.title || 'Impuls 1'}</span>
                <span className="text-xs sm:text-sm md:text-[15px] font-mono font-bold text-teal-200 block leading-tight tracking-tight truncate mt-0.5">
                  {solunar.minor1.start} - {solunar.minor1.end}
                </span>
              </div>
            </div>

            <div className={`${cellSurfaceClass} rounded-xl p-1.5 sm:p-2 md:p-2.5 flex items-center gap-1.5 sm:gap-2 min-w-0 shadow-xs`}>
              <div className="p-1.5 rounded-lg bg-teal-500/15 text-teal-300 border border-teal-500/30 shrink-0">
                <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <span className={labelTextClass}>{solunar.minor2.title || 'Impuls 2'}</span>
                <span className="text-xs sm:text-sm md:text-[15px] font-mono font-bold text-teal-200 block leading-tight tracking-tight truncate mt-0.5">
                  {solunar.minor2.start} - {solunar.minor2.end}
                </span>
              </div>
            </div>

            <div className={`${cellSurfaceClass} rounded-xl p-1.5 sm:p-2 md:p-2.5 flex items-center gap-1.5 sm:gap-2 min-w-0 shadow-xs`}>
              <div className="p-1.5 rounded-lg bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 shrink-0">
                <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <span className={labelTextClass}>Mjesec hod</span>
                <span className="text-xs sm:text-sm md:text-[15px] font-mono font-bold text-indigo-200 block leading-tight tracking-tight truncate mt-0.5">
                  {solunar.moonrise} - {solunar.moonset}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-1.5 sm:gap-2 content-center">
            <div className={`${cellSurfaceClass} rounded-lg px-2 py-1.5 flex flex-col justify-center min-w-0`}>
              <div className="flex items-center gap-1 min-w-0">
                <span className="text-[11px] leading-none shrink-0">{getMoonEmoji(solunar.moonPhase)}</span>
                <span className={labelTextClass}>Faza Mjeseca</span>
              </div>
              <span className="text-[11px] sm:text-xs font-black text-white block leading-tight tracking-tight truncate mt-0.5">
                {solunar.moonPhaseName} <span className="text-[9.5px] text-indigo-300 font-bold">({solunar.illuminationPct}%)</span>
              </span>
            </div>

            <div className={`${cellSurfaceClass} rounded-lg px-2 py-1.5 flex flex-col justify-center min-w-0`}>
              <div className="flex items-center gap-1 min-w-0">
                <Flame className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
                <span className="text-[9.5px] sm:text-[10px] text-amber-300 block uppercase font-black leading-tight truncate">
                  {solunar.major1.title || 'Vrhunac 1'}
                </span>
              </div>
              <span className="text-[11px] sm:text-xs font-mono font-black text-white block leading-tight tracking-tight truncate mt-0.5">
                {solunar.major1.start} - {solunar.major1.end}
              </span>
            </div>

            <div className={`${cellSurfaceClass} rounded-lg px-2 py-1.5 flex flex-col justify-center min-w-0`}>
              <div className="flex items-center gap-1 min-w-0">
                <Flame className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
                <span className="text-[9.5px] sm:text-[10px] text-amber-300 block uppercase font-black leading-tight truncate">
                  {solunar.major2.title || 'Vrhunac 2'}
                </span>
              </div>
              <span className="text-[11px] sm:text-xs font-mono font-black text-white block leading-tight tracking-tight truncate mt-0.5">
                {solunar.major2.start} - {solunar.major2.end}
              </span>
            </div>

            <div className={`${cellSurfaceClass} rounded-lg px-2 py-1.5 flex flex-col justify-center min-w-0`}>
              <div className="flex items-center gap-1 min-w-0">
                <Clock className="w-3 h-3 text-teal-400 shrink-0" />
                <span className={labelTextClass}>{solunar.minor1.title || 'Impuls 1'}</span>
              </div>
              <span className="text-[11px] sm:text-xs font-mono font-bold text-teal-200 block leading-tight tracking-tight truncate mt-0.5">
                {solunar.minor1.start} - {solunar.minor1.end}
              </span>
            </div>

            <div className={`${cellSurfaceClass} rounded-lg px-2 py-1.5 flex flex-col justify-center min-w-0`}>
              <div className="flex items-center gap-1 min-w-0">
                <Clock className="w-3 h-3 text-teal-400 shrink-0" />
                <span className={labelTextClass}>{solunar.minor2.title || 'Impuls 2'}</span>
              </div>
              <span className="text-[11px] sm:text-xs font-mono font-bold text-teal-200 block leading-tight tracking-tight truncate mt-0.5">
                {solunar.minor2.start} - {solunar.minor2.end}
              </span>
            </div>

            <div className={`${cellSurfaceClass} rounded-lg px-2 py-1.5 flex flex-col justify-center min-w-0`}>
              <div className="flex items-center gap-1 min-w-0">
                <Clock className="w-3 h-3 text-indigo-400 shrink-0" />
                <span className={labelTextClass}>Mjesec hod</span>
              </div>
              <span className="text-[11px] sm:text-xs font-mono font-bold text-indigo-200 block leading-tight tracking-tight truncate mt-0.5">
                {solunar.moonrise} - {solunar.moonset}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 4. NOVO: TAKTIČKI KALKULATOR PROTOKA, BISTRINE I JIG GRAMAŽE + OSOBNI ALARM */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 sm:gap-3.5">
        
        {/* LIJEVO: Taktički kalkulator protoka i jig glave (RiverApp stil) */}
        <div className={`${cardSurfaceClass} rounded-xl sm:rounded-2xl p-3 sm:p-4 border ${highContrast ? 'border-cyan-300' : 'border-cyan-500/30'} text-white flex flex-col justify-between gap-2.5`}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-300 shrink-0">
                <Anchor className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-black uppercase tracking-wide text-white">
                  Kalkulator protoka, bistrine i Jig gramaže
                </h3>
                <p className="text-[10px] sm:text-[11px] text-slate-400">
                  Automatski izračun prema protoku Bogojevo ({tacticalRiverCalc.flow} m³/s) i trendu Aljmaša
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className={`${cellSurfaceClass} rounded-xl p-2 flex flex-col`}>
              <span className="text-[9px] text-slate-400 font-bold uppercase">Jig (Obala / Šporanj)</span>
              <span className="text-xs sm:text-sm font-black text-teal-300 font-mono mt-0.5">
                {tacticalRiverCalc.shoreJig}
              </span>
            </div>
            <div className={`${cellSurfaceClass} rounded-xl p-2 flex flex-col`}>
              <span className="text-[9px] text-slate-400 font-bold uppercase">Jig (Čamac / Matica)</span>
              <span className="text-xs sm:text-sm font-black text-cyan-300 font-mono mt-0.5">
                {tacticalRiverCalc.boatJig}
              </span>
            </div>
            <div className={`${cellSurfaceClass} rounded-xl p-2 flex flex-col`}>
              <span className="text-[9px] text-slate-400 font-bold uppercase">Olovo / Feeder</span>
              <span className="text-xs sm:text-sm font-black text-amber-300 font-mono mt-0.5">
                {tacticalRiverCalc.feederLead}
              </span>
            </div>
          </div>

          <div className={`${cellSurfaceClass} rounded-xl p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs`}>
            <div className="flex items-center gap-1.5">
              <Droplets className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="text-slate-400 font-semibold">Prozirnost:</span>
              <strong className={tacticalRiverCalc.clarityColor}>{tacticalRiverCalc.clarityLabel}</strong>
            </div>
            <span className="text-[11px] text-slate-300 sm:text-right">
              🎯 {tacticalRiverCalc.spotAdvice}
            </span>
          </div>
        </div>

        {/* DESNO: Osobni alarm za vodostaj i temperaturu vode */}
        <div className={`${cardSurfaceClass} rounded-xl sm:rounded-2xl p-3 sm:p-4 border ${highContrast ? 'border-amber-300' : 'border-amber-500/30'} text-white flex flex-col justify-between gap-2.5`}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-300 shrink-0">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-black uppercase tracking-wide text-white">
                  Osobni Alarm za Vodostaj i Temp. Vode
                </h3>
                <p className="text-[10px] sm:text-[11px] text-slate-400">
                  Aplikacija šalje zvučnu obavijest čim Dunav dosegne tvoj zadani prag
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowAlertForm(!showAlertForm)}
              className="px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-black text-[11px] flex items-center gap-1 cursor-pointer shrink-0 active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{showAlertForm ? 'Zatvori' : 'Novi alarm'}</span>
            </button>
          </div>

          {showAlertForm && (
            <form onSubmit={handleAddAlert} className={`${cellSurfaceClass} rounded-xl p-2.5 space-y-2`}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs">
                <select
                  value={newStation}
                  onChange={e => setNewStation(e.target.value as 'aljmas' | 'bogojevo')}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-white font-bold"
                >
                  <option value="aljmas">Aljmaš</option>
                  <option value="bogojevo">Bogojevo</option>
                </select>

                <select
                  value={newMetric}
                  onChange={e => {
                    const m = e.target.value as 'level' | 'temp';
                    setNewMetric(m);
                    setNewThreshold(m === 'level' ? String(aljmas.waterLevelCm + 20) : '12');
                  }}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-white font-bold"
                >
                  <option value="level">Vodostaj (cm)</option>
                  <option value="temp">Temp. vode (°C)</option>
                </select>

                <select
                  value={newCondition}
                  onChange={e => setNewCondition(e.target.value as 'above' | 'below')}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-white font-bold"
                >
                  <option value="above">Poraste iznad (≥)</option>
                  <option value="below">Padne ispod (≤)</option>
                </select>

                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.5"
                    value={newThreshold}
                    onChange={e => setNewThreshold(e.target.value)}
                    className="w-full bg-slate-900 border border-amber-500/60 rounded-lg px-2 py-1.5 text-white font-mono font-black text-center"
                    placeholder="Vrijednost"
                  />
                  <button
                    type="submit"
                    className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs cursor-pointer shrink-0 flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Spremi</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {alerts.length === 0 ? (
            <div className={`${cellSurfaceClass} rounded-xl p-2.5 text-xs text-slate-400 flex items-center justify-between`}>
              <span>Nema aktivnih alarma (npr. "Javi kad Aljmaš prijeđe 150 cm ili temp. vode 10 °C").</span>
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {alerts.map(a => (
                <div
                  key={a.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-950 border border-amber-500/35 text-xs"
                >
                  <BellRing className="w-3 h-3 text-amber-400 shrink-0" />
                  <span className="font-bold text-white">
                    {a.station === 'aljmas' ? 'Aljmaš' : 'Bogojevo'}:
                  </span>
                  <span className="text-amber-300 font-mono font-bold">
                    {a.metric === 'level' ? 'Vodostaj' : 'Temp.'} {a.condition === 'above' ? '≥' : '≤'} {a.threshold} {a.metric === 'level' ? 'cm' : '°C'}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveAlert(a.id)}
                    className="text-slate-500 hover:text-rose-400 ml-1 cursor-pointer"
                    title="Obriši alarm"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 5. NOVO: 3-DNEVNA RIBOLOVNA PROGNOZA (VODOSTAJ + VJETAR + SOLUNAR PLANER) */}
      <div className={`${cardSurfaceClass} rounded-xl sm:rounded-2xl p-3 sm:p-4 border ${highContrast ? 'border-indigo-300' : 'border-indigo-500/30'} text-white`}>
        <div className="flex items-center justify-between gap-2 mb-2.5 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-300 shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-black uppercase tracking-wide text-white">
                3-Dnevna Ribolovna Prognoza (Vodostaj + Vjetar + Solunar)
              </h3>
              <p className="text-[10px] sm:text-[11px] text-slate-400">
                Brzi planer za izlazak na Dunav za naredna 3 dana
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {threeDayForecast.map(day => (
            <div
              key={day.offset}
              className={`${cellSurfaceClass} rounded-xl p-2.5 flex flex-col justify-between gap-1.5`}
            >
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
                <span className="text-xs sm:text-sm font-black text-white capitalize">
                  {day.dayLabel}
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-[11px] font-black">
                  {day.solunarScore}/5★ ({day.activityPct}%)
                </span>
              </div>

              <div className="grid grid-cols-2 gap-1.5 text-[11px] py-0.5">
                <div>
                  <span className="text-[9px] text-slate-400 uppercase font-bold block">Aljmaš / Bogojevo</span>
                  <span className="font-mono font-black text-teal-300">
                    {day.estAljmas} cm <span className="text-slate-500">/</span> <span className="text-cyan-300">{day.estBogojevo} cm</span>
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 uppercase font-bold block">Glavni griz (Vrhunci)</span>
                  <span className="font-mono font-bold text-amber-200 text-[10.5px]">
                    {day.major1} · {day.major2}
                  </span>
                </div>
              </div>

              <div className="pt-1 border-t border-slate-800/60 flex items-center justify-between text-[10.5px]">
                <span className="text-slate-400 flex items-center gap-1">
                  <Wind className="w-3 h-3 text-blue-400" />
                  <span>{day.estWind} m/s</span>
                </span>
                <span className={`font-bold ${day.boatSafety.color}`}>
                  {day.boatSafety.text}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* PODNOŽJE: Brzi pristup Solunaru, Lovostaju i Ulovima */}
      <div className="mt-4 sm:mt-6 p-3.5 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/70 to-slate-900 border border-indigo-500/40 shadow-xl flex flex-col md:flex-row items-center justify-between gap-3 sm:gap-4 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-full bg-gradient-to-l from-indigo-500/10 to-transparent pointer-events-none" />

        <div className="flex items-center gap-3 text-center md:text-left w-full md:w-auto">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-2xl shrink-0 shadow-inner">
            🎣
          </div>
          <div className="min-w-0 text-left">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base md:text-lg font-black text-white tracking-tight">
                {APP_FEATURES.ENABLE_PRO_MODE ? 'Pro Ribolovni Mod' : 'Ribolovni Centar Dunava'}
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-gradient-to-r from-teal-500 to-indigo-400 text-slate-950 shadow-xs">
                {APP_FEATURES.ENABLE_PRO_MODE ? 'PRO NAČIN' : 'OSNOVNI MOD'}
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-300 mt-0.5 max-w-xl leading-snug">
              {APP_FEATURES.ENABLE_PRO_MODE 
                ? '24-satna prognoza aktivnosti, taktički mamci za smuđa, soma i šarana, te hidrološki grafovi.' 
                : 'Službeni vodostaji Dunava, barometar, Dnevni solunarni griz, kalendar lovostaja i evidencija ulova.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          {onOpenSolunar && (
            <button
              type="button"
              onClick={onOpenSolunar}
              className="px-3.5 py-2.5 sm:py-3 rounded-xl bg-indigo-950/80 hover:bg-indigo-900 text-indigo-200 border border-indigo-500/40 font-bold text-xs sm:text-sm transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
              title="Otvori detaljni Dnevni Solunar i vrijeme griza"
            >
              <span>🌙 Dnevni Solunar</span>
            </button>
          )}
          {onOpenLovostaj && (
            <button
              type="button"
              onClick={onOpenLovostaj}
              className="px-3.5 py-2.5 sm:py-3 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 text-emerald-200 border border-emerald-500/40 font-bold text-xs sm:text-sm transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
              title="Pregled pravilnika o lovostaju i najmanjim mjerama"
            >
              <span>🐟 Lovostaj</span>
            </button>
          )}
          {onOpenCatchLog && (
            <button
              type="button"
              onClick={onOpenCatchLog}
              className="px-3.5 py-2.5 sm:py-3 rounded-xl bg-amber-950/80 hover:bg-amber-900 text-amber-200 border border-amber-500/40 font-bold text-xs sm:text-sm transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
              title="Zajednička evidencija ulova po vrstama ribe (Sikac, Krasni, Domo, Mališa)"
            >
              <span>🏆 Evidencija ulova</span>
            </button>
          )}
          {APP_FEATURES.ENABLE_PRO_MODE && (
            <button
              type="button"
              onClick={() => onOpenExpertSection()}
              className="flex-1 md:flex-none px-5 py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-indigo-500 via-cyan-400 to-teal-400 hover:from-indigo-400 hover:to-teal-300 text-slate-950 font-black text-xs sm:text-sm tracking-wide uppercase transition-all shadow-lg shadow-cyan-500/20 active:scale-95 flex items-center justify-center gap-2 shrink-0 cursor-pointer"
            >
              <span>Otvori Pro Mod</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </button>
          )}
        </div>
      </div>

    </div>
  );
};
