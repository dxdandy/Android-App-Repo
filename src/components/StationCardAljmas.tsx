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
  Calendar,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { StationWaterData } from '../types/fishing';

interface StationCardAljmasProps {
  data: StationWaterData;
  isLoading: boolean;
}

export const StationCardAljmas: React.FC<StationCardAljmasProps> = ({ data, isLoading }) => {
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
      label = `U porastu (+${change} cm)`;
      color = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    } else if (trend === 'opada' || change < 0) {
      label = `Opada (${change} cm)`;
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
    <article className="bg-slate-900 text-white rounded-3xl p-5 sm:p-7 shadow-xl border border-teal-500/30 relative overflow-hidden">
      
      {/* Pozadinski svjetlosni efekt */}
      <div className="absolute -right-20 -top-20 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Zaglavlje postaje */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold tracking-wide uppercase bg-teal-500/20 text-teal-300 border border-teal-500/40">
              Službena hidro postaja #148
            </span>
            <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
              <MapPin className="w-3.5 h-3.5 text-teal-400" />
              Dunav {data.riverKm} • Sektor 2
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-white mt-1 tracking-tight flex items-center gap-2">
            <span>🌊 Dunav - Aljmaš</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
            Ušće Drave u Dunav • Aljmaški kameni šporanj
          </p>
        </div>

        {/* Gumb na službeni izvor mvodostaji.voda.hr */}
        <a
          href={data.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-teal-200 bg-teal-950/70 hover:bg-teal-900 border border-teal-600/50 transition-all self-start sm:self-auto cursor-pointer shadow-sm hover:scale-[1.02]"
        >
          <span>mvodostaji.voda.hr</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Glavni podaci o vodostaju */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
        
        {/* Velika kartica trenutnog vodostaja */}
        <div className="md:col-span-1 bg-gradient-to-br from-slate-800/90 to-slate-900/90 rounded-2xl p-5 border border-teal-500/30 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider font-bold text-teal-300 flex items-center gap-1.5">
              <Waves className="w-4 h-4 text-teal-400" />
              Trenutni Vodostaj
            </span>
            {getTrendBadge(data.waterLevelTrend, data.waterLevelChangeCm)}
          </div>

          <div className="my-4">
            <div className="flex items-baseline gap-2">
              <span className="text-5xl sm:text-6xl font-black tracking-tight text-white">
                {data.waterLevelCm}
              </span>
              <span className="text-xl font-bold text-teal-300">cm</span>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              Referentna kota za profil Aljmaš
            </p>
          </div>

          <div className="pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs text-slate-300">
            <span className="flex items-center gap-1 font-mono">
              <Clock className="w-3.5 h-3.5 text-teal-400" />
              Mjerenje: {data.timeOfMeasurement} h
            </span>
            <span className="flex items-center gap-1 font-mono">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              {data.dateOfMeasurement}
            </span>
          </div>
        </div>

        {/* Meteorološki podaci (Vinkovci / Aljmaš) */}
        <div className="md:col-span-1 bg-slate-800/50 rounded-2xl p-5 border border-slate-700/70 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase tracking-wider font-bold text-slate-300 flex items-center gap-1.5">
                <Gauge className="w-4 h-4 text-cyan-400" />
                Meteo & Barometar (Vinkovci)
              </span>
              <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                Povoljan tlak
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
                  Ugodno uz Dunav
                </span>
              </div>

              <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-400 block text-[11px]">Vjetar na vodi:</span>
                <span className="text-lg font-bold text-white mt-0.5 block">
                  {data.windSpeedKmh} km/h
                </span>
                <span className="text-[10px] text-teal-300 font-medium">
                  Smjer: {data.windDirection}
                </span>
              </div>

              <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-400 block text-[11px]">Temperatura Dunava:</span>
                <span className="text-lg font-bold text-teal-300 mt-0.5 block">
                  {data.waterTempC} °C
                </span>
                <span className="text-[10px] text-slate-400">
                  Optimalno za grabežljivce
                </span>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 italic">
            Podaci barometra ažurirani za područje Vinkovaca i istočne Slavonije.
          </div>
        </div>

        {/* Karakteristični vodostaji i granice obrane */}
        <div className="md:col-span-1 bg-slate-800/50 rounded-2xl p-5 border border-slate-700/70 flex flex-col justify-between">
          <div>
            <span className="text-xs uppercase tracking-wider font-bold text-slate-300 flex items-center gap-1.5 mb-3">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              Karakteristične Kote Aljmaš
            </span>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between p-2.5 bg-slate-900/60 rounded-xl border border-slate-800">
                <span className="text-slate-300">Pripremno stanje obrane:</span>
                <span className="font-bold text-amber-400">{data.prepLevelCm || 400} cm</span>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-slate-900/60 rounded-xl border border-slate-800">
                <span className="text-slate-300">Redovna obrana od poplava:</span>
                <span className="font-bold text-amber-300">600 cm</span>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-slate-900/60 rounded-xl border border-slate-800">
                <div>
                  <span className="text-slate-300 block">Povijesni maksimum:</span>
                  <span className="text-[10px] text-slate-500">Zabilježeno: {data.maxLevelDate || '25.06.1965.'}</span>
                </div>
                <span className="font-bold text-rose-400">{data.maxLevelCm || 820} cm</span>
              </div>
            </div>
          </div>

          {/* Trenutno stanje vodostaja prema granicama */}
          <div className="mt-3 p-2.5 rounded-xl bg-teal-950/40 border border-teal-800/40 text-[11px] text-teal-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Normalan vodostaj. Dunav je stabilan, siguran za čamce i ribolov s obale.</span>
          </div>

        </div>

      </div>

      {/* Zadnja satna mjerenja sa stranice mvodostaji.voda.hr */}
      <div className="bg-slate-950/70 rounded-2xl p-4 sm:p-5 border border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-teal-400" />
            <h4 className="text-xs sm:text-sm font-bold text-white">
              Zadnja hidrološka mjerenja po satima (mvodostaji.voda.hr)
            </h4>
          </div>
          <span className="text-[11px] text-slate-400">Postaja 148 Aljmaš</span>
        </div>

        {/* Tablica mjerenja */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                <th className="py-2 px-3">Datum</th>
                <th className="py-2 px-3">Vrijeme</th>
                <th className="py-2 px-3">Vodostaj (cm)</th>
                <th className="py-2 px-3">Promjena</th>
                <th className="py-2 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {data.recentHistory && data.recentHistory.length > 0 ? (
                data.recentHistory.slice(0, 8).map((row, idx) => (
                  <tr key={idx} className={idx === 0 ? 'bg-teal-950/30 text-teal-200 font-bold' : 'text-slate-300'}>
                    <td className="py-2 px-3">{row.date}</td>
                    <td className="py-2 px-3">{row.time}</td>
                    <td className="py-2 px-3 font-bold text-white">{row.level} cm</td>
                    <td className="py-2 px-3">
                      {row.trendChange !== undefined ? (
                        row.trendChange > 0 ? (
                          <span className="text-emerald-400">+{row.trendChange} cm</span>
                        ) : row.trendChange < 0 ? (
                          <span className="text-rose-400">{row.trendChange} cm</span>
                        ) : (
                          <span className="text-slate-400">0 cm</span>
                        )
                      ) : (
                        '--'
                      )}
                    </td>
                    <td className="py-2 px-3">
                      {idx === 0 ? (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-teal-500/20 text-teal-300 border border-teal-500/30">
                          Zadnje mjerenje
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500">Arhiva</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-3 text-center text-slate-500">
                    Učitavanje satnih podataka sa stranice mvodostaji.voda.hr...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </article>
  );
};
