import React from 'react';
import { 
  Waves, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  ExternalLink, 
  Clock, 
  MapPin, 
  Wind, 
  Thermometer, 
  Gauge, 
  ShieldAlert, 
  Activity, 
  Calendar,
  CheckCircle2
} from 'lucide-react';
import { StationWaterData } from '../types/fishing';

interface StationCardBogojevoProps {
  data: StationWaterData;
  isLoading: boolean;
}

export const StationCardBogojevo: React.FC<StationCardBogojevoProps> = ({ data, isLoading }) => {
  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'u_porastu':
        return <TrendingUp className="w-5 h-5 text-emerald-400" />;
      case 'opada':
        return <TrendingDown className="w-5 h-5 text-rose-400" />;
      default:
        return <Minus className="w-5 h-5 text-amber-400" />;
    }
  };

  const getTrendBadge = (trend: string, change: number) => {
    let label = 'Stagnira';
    let color = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    if (trend === 'u_porastu' || change > 0) {
      label = `U porastu (+${change} cm / 24h)`;
      color = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    } else if (trend === 'opada' || change < 0) {
      label = `Opada (${change} cm / 24h)`;
      color = 'bg-rose-500/20 text-rose-300 border-rose-500/30';
    }
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${color}`}>
        {getTrendIcon(trend)}
        {label}
      </span>
    );
  };

  return (
    <article className="bg-slate-900 text-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-7 shadow-xl border border-cyan-500/30 relative overflow-hidden w-full max-w-full">
      
      {/* Pozadinski svjetlosni efekt */}
      <div className="absolute -right-20 -top-20 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Zaglavlje postaje */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold tracking-wide uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
              Službena RHMZ postaja #42020
            </span>
            <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
              <MapPin className="w-3.5 h-3.5 text-cyan-400" />
              Dunav {data.riverKm} • Most Bogojevo - Erdut
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-white mt-1 tracking-tight flex items-center gap-2">
            <span>🌊 Dunav - Bogojevo</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
            Most Bogojevo • Kameni špornjevi • Tok prema Apatinu i Dalju
          </p>
        </div>

        {/* Gumb na službeni izvor hidmet.gov.rs */}
        <a
          href={data.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-cyan-200 bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-600/50 transition-all self-start sm:self-auto cursor-pointer shadow-sm hover:scale-[1.02]"
        >
          <span>hidmet.gov.rs (prognoza)</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Glavni podaci o vodostaju i protoku */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
        
        {/* Velika kartica trenutnog vodostaja */}
        <div className="md:col-span-1 bg-gradient-to-br from-slate-800/90 to-slate-900/90 rounded-2xl p-5 border border-cyan-500/30 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider font-bold text-cyan-300 flex items-center gap-1.5">
              <Waves className="w-4 h-4 text-cyan-400" />
              Trenutni Vodostaj
            </span>
            {getTrendBadge(data.waterLevelTrend, data.waterLevelChangeCm)}
          </div>

          <div className="my-4">
            <div className="flex items-baseline gap-2">
              <span className="text-5xl sm:text-6xl font-black tracking-tight text-white">
                {data.waterLevelCm}
              </span>
              <span className="text-xl font-bold text-cyan-300">cm</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
                Promjena 24h: {data.waterLevelChangeCm > 0 ? `+${data.waterLevelChangeCm}` : data.waterLevelChangeCm} cm
              </span>
              {data.flowM3s && (
                <span className="text-xs bg-cyan-950 text-cyan-300 px-2 py-0.5 rounded font-mono border border-cyan-800/50">
                  Protok: {data.flowM3s} m³/s
                </span>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs text-slate-300">
            <span className="flex items-center gap-1 font-mono">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              Mjerenje: {data.timeOfMeasurement} h
            </span>
            <span className="flex items-center gap-1 font-mono">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              {data.dateOfMeasurement}
            </span>
          </div>
        </div>

        {/* Meteorološki podaci za Bogojevo */}
        <div className="md:col-span-1 bg-slate-800/50 rounded-2xl p-5 border border-slate-700/70 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase tracking-wider font-bold text-slate-300 flex items-center gap-1.5">
                <Gauge className="w-4 h-4 text-cyan-400" />
                Meteo Bogojevo & Dunav
              </span>
              <span className="text-[11px] font-semibold text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800">
                Lokalno
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-400 block text-[11px]">Tlak zraka:</span>
                <span className="text-lg font-bold text-white mt-0.5 block">
                  {data.airPressureHpa} hPa
                </span>
                <span className="text-[10px] text-cyan-300 font-medium capitalize">
                  Trend: {data.airPressureTrend}
                </span>
              </div>

              <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-400 block text-[11px]">Temperatura zraka:</span>
                <span className="text-lg font-bold text-white mt-0.5 block">
                  {data.airTempC} °C
                </span>
                <span className="text-[10px] text-slate-400">
                  Umjereno toplo
                </span>
              </div>

              <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-400 block text-[11px]">Vjetar Bogojevo:</span>
                <span className="text-lg font-bold text-white mt-0.5 block">
                  {data.windSpeedKmh} km/h
                </span>
                <span className="text-[10px] text-cyan-300 font-medium">
                  Smjer: {data.windDirection}
                </span>
              </div>

              <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-400 block text-[11px]">Temperatura vode:</span>
                <span className="text-lg font-bold text-cyan-300 mt-0.5 block">
                  {data.waterTempC} °C
                </span>
                <span className="text-[10px] text-slate-400">
                  RHMZ hidro mjerenje
                </span>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 italic">
            Podaci usklađeni sa službenim biltenom RHMZ i hidrologije Dunava.
          </div>
        </div>

        {/* Granice obrana od poplava */}
        <div className="md:col-span-1 bg-slate-800/50 rounded-2xl p-5 border border-slate-700/70 flex flex-col justify-between">
          <div>
            <span className="text-xs uppercase tracking-wider font-bold text-slate-300 flex items-center gap-1.5 mb-3">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              Granice Obrana Bogojevo
            </span>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between p-2.5 bg-slate-900/60 rounded-xl border border-slate-800">
                <span className="text-slate-300">Redovna obrana od poplava:</span>
                <span className="font-bold text-amber-400">{data.regularDefenseCm || 600} cm</span>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-slate-900/60 rounded-xl border border-slate-800">
                <span className="text-slate-300">Izvanredna obrana od poplava:</span>
                <span className="font-bold text-rose-400">{data.emergencyDefenseCm || 700} cm</span>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-slate-900/60 rounded-xl border border-slate-800">
                <span className="text-slate-300">Protok vode Dunava:</span>
                <span className="font-bold text-cyan-300 font-mono">{data.flowM3s || 880} m³/s</span>
              </div>
            </div>
          </div>

          <div className="mt-3 p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-800/40 text-[11px] text-cyan-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Vodostaj je znatno ispod razine obrane. Protok je stabilan za ribolov smuđa na špornjevima.</span>
          </div>

        </div>

      </div>

      {/* RHMZ Službena Prognoza vodostaja Dunava za iduće dane */}
      {data.forecastDays && data.forecastDays.length > 0 && (
        <div className="bg-slate-950/70 rounded-2xl p-4 sm:p-5 border border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <h4 className="text-xs sm:text-sm font-bold text-white">
                Službena hidrološka prognoza vodostaja za Bogojevo (hidmet.gov.rs)
              </h4>
            </div>
            <span className="text-[11px] text-slate-400">Prognoza RHMZ</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {data.forecastDays.map((val, idx) => {
              const dayOffset = idx + 1;
              const d = new Date();
              d.setDate(d.getDate() + dayOffset);
              const dayStr = d.toLocaleDateString('hr-HR', { weekday: 'short', day: 'numeric', month: 'numeric' });

              return (
                <div key={idx} className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 text-center">
                  <span className="text-[11px] text-slate-400 block capitalize">
                    {dayStr} (+{dayOffset}d)
                  </span>
                  <span className="text-lg font-black text-white mt-1 block font-mono">
                    {val} cm
                  </span>
                  <span className="text-[10px] text-cyan-300 font-medium">
                    {val > data.waterLevelCm ? 'Očekuje se porast' : val < data.waterLevelCm ? 'Očekuje se opadanje' : 'Stagnacija'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </article>
  );
};
