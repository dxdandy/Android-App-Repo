import React from 'react';
import { Scale, ArrowRight, Waves, Thermometer, Gauge, Wind } from 'lucide-react';
import { StationWaterData } from '../types/fishing';
import { ScrollToTopButton } from './ScrollToTopButton';

interface StationsComparisonCardProps {
  aljmas: StationWaterData;
  bogojevo: StationWaterData;
}

export const StationsComparisonCard: React.FC<StationsComparisonCardProps> = ({
  aljmas,
  bogojevo
}) => {
  return (
    <section className="bg-slate-900 text-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-7 shadow-xl border border-indigo-500/30 relative overflow-hidden w-full max-w-full">
      
      {/* Zaglavlje usporedbe */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4 mb-6">
        <div className="flex-1 min-w-0">
          {/* Prvi red poglavlja: naslov lijevo, strelica za vrh na kraju desno */}
          <div className="flex items-center justify-between gap-2 w-full">
            <div className="flex items-center gap-2 min-w-0">
              <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0">
                <Scale className="w-4 h-4" />
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight truncate">
                Usporedba Dunava: Aljmaš vs Bogojevo
              </h3>
            </div>

            <ScrollToTopButton theme="indigo" />
          </div>
          <p className="text-xs text-slate-300 mt-1">
            Usporedni profil rijeke Dunav između rkm 1380,300 (Aljmaš) i rkm 1367,000 (Bogojevo)
          </p>
        </div>

        <div className="text-xs text-slate-400 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700 font-mono">
          Udaljenost: ~13,3 riječna kilometra nizvodno
        </div>
      </div>

      {/* Komparativna tablica */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs sm:text-sm text-left">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 font-semibold">
              <th className="py-3 px-4">Hidrometeo Parametar</th>
              <th className="py-3 px-4 text-teal-300 font-bold bg-teal-950/20 rounded-t-xl">
                🌊 Aljmaš (Hrvatska)
              </th>
              <th className="py-3 px-4 text-cyan-300 font-bold bg-cyan-950/20 rounded-t-xl">
                🌊 Bogojevo (Srbija)
              </th>
              <th className="py-3 px-4 text-slate-400">Analiza i Utjecaj</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 font-mono text-xs">
            
            {/* Vodostaj */}
            <tr>
              <td className="py-3 px-4 font-sans font-semibold text-slate-300 flex items-center gap-2">
                <Waves className="w-4 h-4 text-cyan-400" />
                Trenutni vodostaj:
              </td>
              <td className="py-3 px-4 text-white font-black text-base bg-teal-950/20">
                {aljmas.waterLevelCm} cm
              </td>
              <td className="py-3 px-4 text-white font-black text-base bg-cyan-950/20">
                {bogojevo.waterLevelCm} cm
              </td>
              <td className="py-3 px-4 font-sans text-slate-300">
                Razlika kote: {Math.abs(aljmas.waterLevelCm - bogojevo.waterLevelCm)} cm. Povoljan nizak vodostaj za prilaz špornjevima.
              </td>
            </tr>

            {/* Trend 24h */}
            <tr>
              <td className="py-3 px-4 font-sans font-semibold text-slate-300">
                Trend vodostaja:
              </td>
              <td className="py-3 px-4 text-amber-300 font-bold bg-teal-950/20 capitalize">
                {aljmas.waterLevelTrend} ({aljmas.waterLevelChangeCm >= 0 ? `+${aljmas.waterLevelChangeCm}` : aljmas.waterLevelChangeCm} cm)
              </td>
              <td className="py-3 px-4 text-emerald-300 font-bold bg-cyan-950/20 capitalize">
                {bogojevo.waterLevelTrend} (+{bogojevo.waterLevelChangeCm} cm)
              </td>
              <td className="py-3 px-4 font-sans text-slate-300">
                Lagani dolazak vode uzvodno kreće se prema Bogojevu; aktivira se smuđ.
              </td>
            </tr>

            {/* Protok vode */}
            <tr>
              <td className="py-3 px-4 font-sans font-semibold text-slate-300">
                Protok vode / Stanje:
              </td>
              <td className="py-3 px-4 text-slate-300 bg-teal-950/20">
                Ušće Drave unosi dodatnu masu vode
              </td>
              <td className="py-3 px-4 text-cyan-300 font-bold bg-cyan-950/20">
                {bogojevo.flowM3s || 880} m³/s
              </td>
              <td className="py-3 px-4 font-sans text-slate-300">
                Srednji stabilan protok; idealan otpor za silikonske varalice od 15-28g.
              </td>
            </tr>

            {/* Temperatura vode */}
            <tr>
              <td className="py-3 px-4 font-sans font-semibold text-slate-300 flex items-center gap-2">
                <Thermometer className="w-4 h-4 text-teal-400" />
                Temperatura vode:
              </td>
              <td className="py-3 px-4 text-teal-300 font-bold bg-teal-950/20">
                {aljmas.waterTempC} °C
              </td>
              <td className="py-3 px-4 text-cyan-300 font-bold bg-cyan-950/20">
                {bogojevo.waterTempC} °C
              </td>
              <td className="py-3 px-4 font-sans text-slate-300">
                Idealna temperatura za intenzivno hranjenje bijele ribe i grabljivica.
              </td>
            </tr>

            {/* Tlak zraka */}
            <tr>
              <td className="py-3 px-4 font-sans font-semibold text-slate-300 flex items-center gap-2">
                <Gauge className="w-4 h-4 text-cyan-400" />
                Tlak zraka & Barometar:
              </td>
              <td className="py-3 px-4 text-white font-bold bg-teal-950/20">
                {aljmas.airPressureHpa} hPa (Vinkovci)
              </td>
              <td className="py-3 px-4 text-white font-bold bg-cyan-950/20">
                {bogojevo.airPressureHpa} hPa (Bogojevo)
              </td>
              <td className="py-3 px-4 font-sans text-slate-300">
                Ujednačen stabilan anticiklon; stabilno ponašanje riba bez naglih prekida griza.
              </td>
            </tr>

            {/* Vjetar */}
            <tr>
              <td className="py-3 px-4 font-sans font-semibold text-slate-300 flex items-center gap-2">
                <Wind className="w-4 h-4 text-slate-400" />
                Brzina i smjer vjetra:
              </td>
              <td className="py-3 px-4 text-slate-300 bg-teal-950/20">
                {aljmas.windSpeedMs ?? (aljmas.windSpeedKmh / 3.6).toFixed(1)} m/s ({aljmas.windDirection})
              </td>
              <td className="py-3 px-4 text-slate-300 bg-cyan-950/20">
                {bogojevo.windSpeedMs ?? (bogojevo.windSpeedKmh / 3.6).toFixed(1)} m/s ({bogojevo.windDirection})
              </td>
              <td className="py-3 px-4 font-sans text-slate-300">
                Umjeren vjetar stvara lagani val na Dunavu što razbija svjetlost i olakšava lov varalicom.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

    </section>
  );
};
