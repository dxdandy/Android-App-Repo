import React from 'react';
import { 
  Sparkles, 
  Moon, 
  Sun, 
  Sunrise, 
  Sunset, 
  Clock, 
  Star, 
  Flame, 
  Compass, 
  Fish, 
  CheckCircle2, 
  Info,
  Calendar
} from 'lucide-react';
import { SolunarDayData } from '../types/fishing';

interface SolunarDailyDashboardProps {
  solunar: SolunarDayData;
  isLoading: boolean;
}

export const SolunarDailyDashboard: React.FC<SolunarDailyDashboardProps> = ({ solunar, isLoading }) => {
  const getMoonIcon = (phase: string) => {
    switch (phase) {
      case 'pun_mjesec':
        return '🌕';
      case 'mladjak':
        return '🌑';
      case 'prva_cetvrt':
        return '🌓';
      case 'zadnja_cetvrt':
        return '🌗';
      case 'rastuci_srp':
        return '🌒';
      case 'opadajuci_srp':
        return '🌘';
      default:
        return '🌔';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'vrhunac':
        return 'bg-emerald-500 text-slate-950 font-black shadow-emerald-500/50 shadow-sm';
      case 'visoka':
        return 'bg-teal-400 text-slate-950 font-bold';
      case 'srednja':
        return 'bg-cyan-700/80 text-white';
      default:
        return 'bg-slate-800 text-slate-400';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'vrhunac':
        return 'VRHUNAC (Griz)';
      case 'visoka':
        return 'Visoka aktivnost';
      case 'srednja':
        return 'Umjereno';
      default:
        return 'Normalno';
    }
  };

  return (
    <section className="bg-slate-900 text-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-7 shadow-xl border border-indigo-500/30 relative overflow-hidden w-full max-w-full">
      
      {/* Pozadinski svjetlosni efekt */}
      <div className="absolute -left-20 -top-20 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Zaglavlje Solunarnog centra */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold tracking-wide uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              Solunar za današnji dan
            </span>
            <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
              <Calendar className="w-3.5 h-3.5 text-indigo-400" />
              {solunar.formattedDate}
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-white mt-1 tracking-tight flex items-center gap-2">
            <span>🌙 Solunarni Rezultati & Aktivnost Riba</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
            Astronomski izračun mjesečevih i sunčevih ciklusa za ribolov na rijeci Dunav
          </p>
        </div>

        {/* Dnevna ocjena ribolova */}
        <div className="bg-gradient-to-r from-indigo-950 to-slate-900 border border-indigo-500/40 p-3.5 rounded-2xl flex items-center gap-3.5 self-start sm:self-auto shadow-md">
          <div className="text-3xl sm:text-4xl">
            {getMoonIcon(solunar.moonPhase)}
          </div>
          <div>
            <div className="flex items-center gap-1 text-amber-400">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star 
                  key={i} 
                  className={`w-4 h-4 ${i < solunar.overallScore ? 'fill-amber-400 text-amber-400' : 'text-slate-600'}`} 
                />
              ))}
              <span className="text-xs font-black text-white ml-1">
                {solunar.activityPercentage}%
              </span>
            </div>
            <div className="text-xs font-bold text-indigo-200 mt-0.5">
              {solunar.ratingText}
            </div>
          </div>
        </div>

      </div>

      {/* Kratki sažetak dana */}
      <div className="my-5 p-3.5 rounded-2xl bg-indigo-950/40 border border-indigo-800/40 text-xs text-indigo-200 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-white">Sažetak za danas: </span>
          <span>{solunar.summaryExplanation}</span>
        </div>
      </div>

      {/* 4 Ključna Solunarna Razdoblja (Major 1, Major 2, Minor 1, Minor 2) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 my-6">
        
        {/* Major 1 */}
        <div className="bg-gradient-to-b from-indigo-900/40 to-slate-800/80 rounded-2xl p-4 border border-indigo-500/40 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-indigo-300 flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                GLAVNO 1 (Major 1)
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                Maksimalni griz
              </span>
            </div>
            <div className="text-2xl font-black text-white font-mono my-2">
              {solunar.major1.start} - {solunar.major1.end}
            </div>
            <p className="text-[11px] text-slate-300 leading-snug">
              {solunar.major1.description}
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-700/60 text-[10px] text-indigo-300 font-medium">
            Vrhunac: oko <strong>{solunar.major1.peak} h</strong>
          </div>
        </div>

        {/* Major 2 */}
        <div className="bg-gradient-to-b from-indigo-900/40 to-slate-800/80 rounded-2xl p-4 border border-indigo-500/40 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-indigo-300 flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                GLAVNO 2 (Major 2)
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                Noćni vrhunac
              </span>
            </div>
            <div className="text-2xl font-black text-white font-mono my-2">
              {solunar.major2.start} - {solunar.major2.end}
            </div>
            <p className="text-[11px] text-slate-300 leading-snug">
              {solunar.major2.description}
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-700/60 text-[10px] text-indigo-300 font-medium">
            Vrhunac: oko <strong>{solunar.major2.peak} h</strong>
          </div>
        </div>

        {/* Minor 1 */}
        <div className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700/70 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-teal-400" />
                SPOREDNO 1 (Minor 1)
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 font-semibold border border-teal-500/30">
                Jutarnji impuls
              </span>
            </div>
            <div className="text-2xl font-black text-white font-mono my-2">
              {solunar.minor1.start} - {solunar.minor1.end}
            </div>
            <p className="text-[11px] text-slate-300 leading-snug">
              {solunar.minor1.description}
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-700/60 text-[10px] text-slate-400">
            Trajanje: ~1 sat
          </div>
        </div>

        {/* Minor 2 */}
        <div className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700/70 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-teal-400" />
                SPOREDNO 2 (Minor 2)
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 font-semibold border border-teal-500/30">
                Večernji impuls
              </span>
            </div>
            <div className="text-2xl font-black text-white font-mono my-2">
              {solunar.minor2.start} - {solunar.minor2.end}
            </div>
            <p className="text-[11px] text-slate-300 leading-snug">
              {solunar.minor2.description}
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-700/60 text-[10px] text-slate-400">
            Trajanje: ~1 sat
          </div>
        </div>

      </div>

      {/* Sunčevi i Mjesečevi podaci (Izlazak, Zalazak, Mjesečeva mijena) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-6">
        
        <div className="bg-slate-800/50 p-3.5 rounded-2xl border border-slate-700 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <Sunrise className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 block">Izlazak Sunca</span>
            <span className="text-base font-black text-white font-mono">{solunar.sunrise} h</span>
            <span className="text-[10px] text-amber-300/80 block">Jutarnji cug</span>
          </div>
        </div>

        <div className="bg-slate-800/50 p-3.5 rounded-2xl border border-slate-700 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-orange-500/20 text-orange-400 border border-orange-500/30">
            <Sunset className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 block">Zalazak Sunca</span>
            <span className="text-base font-black text-white font-mono">{solunar.sunset} h</span>
            <span className="text-[10px] text-orange-300/80 block">Sumrak smuđa</span>
          </div>
        </div>

        <div className="bg-slate-800/50 p-3.5 rounded-2xl border border-slate-700 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            <Moon className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 block">Mjesečeva mijena</span>
            <span className="text-xs font-black text-white block">{solunar.moonPhaseName}</span>
            <span className="text-[10px] text-indigo-300 font-mono block">Osvijetljenost {solunar.illuminationPct}%</span>
          </div>
        </div>

        <div className="bg-slate-800/50 p-3.5 rounded-2xl border border-slate-700 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-500/30">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 block">Zlatni sat (Dunav)</span>
            <span className="text-xs font-bold text-teal-200 block">{solunar.goldenHourEvening}</span>
            <span className="text-[10px] text-slate-400 block">Najbolje na špornju</span>
          </div>
        </div>

      </div>

      {/* 24-satna Vremenska Traka Aktivnosti (Hourly Solunar Activity) */}
      <div className="bg-slate-950/80 rounded-2xl p-4 sm:p-5 border border-slate-800 my-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-400" />
            <h4 className="text-xs sm:text-sm font-bold text-white">
              24-satna solunarna aktivnost riba za danas (00:00 - 23:00)
            </h4>
          </div>
          <div className="flex items-center gap-2 text-[10px] flex-wrap">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Vrhunac
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-400" /> Visoka
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-700" /> Umjerena
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-800" /> Normalna
            </span>
          </div>
        </div>

        {/* 24-satni grid */}
        <div className="grid grid-cols-6 sm:grid-cols-12 md:grid-cols-24 gap-1.5 pt-1">
          {solunar.hourlyActivity.map((item) => (
            <div 
              key={item.hour}
              className={`flex flex-col items-center justify-between p-1.5 rounded-lg border border-slate-700/60 transition-all ${
                item.status === 'vrhunac' ? 'ring-2 ring-emerald-400 scale-105 z-10' : ''
              }`}
            >
              <span className="text-[10px] font-mono text-slate-300">
                {item.hourLabel.replace(':00', 'h')}
              </span>
              <div 
                className={`w-full h-8 sm:h-10 rounded-md my-1 flex items-center justify-center text-[10px] font-bold ${getStatusColor(item.status)}`}
                title={`${item.hourLabel} - ${getStatusLabel(item.status)} (Ocjena: ${item.score}/5)`}
              >
                {item.score}★
              </div>
              <span className="text-[9px] text-slate-400 truncate w-full text-center">
                {item.status === 'vrhunac' ? 'Griz!' : item.status === 'visoka' ? 'Visoko' : ''}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Savjeti za ribolov po vrstama riba na Dunavu */}
      <div className="bg-slate-950/70 rounded-2xl p-4 sm:p-5 border border-slate-800">
        <div className="flex items-center gap-2 mb-4">
          <Fish className="w-4 h-4 text-cyan-400" />
          <h4 className="text-xs sm:text-sm font-bold text-white">
            Preporuke za ribolov na Dunavu danas (Aljmaš & Bogojevo)
          </h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {solunar.fishAdvices.map((fa, idx) => (
            <div key={idx} className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm text-white flex items-center gap-2">
                    <span className="text-lg">{fa.icon}</span>
                    {fa.species}
                  </span>
                  <span className="text-[10px] text-cyan-300 font-mono bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800">
                    {fa.recommendedDepth}
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {fa.advice}
                </p>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-800 text-[11px] text-slate-400">
                <span className="text-slate-500 font-semibold">Preporučeni mamci: </span>
                <span className="text-teal-200">{fa.recommendedBaits}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

    </section>
  );
};
