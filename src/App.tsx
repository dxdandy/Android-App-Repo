import React, { useState, useEffect, useCallback } from 'react';
import { 
  Waves, 
  Sparkles, 
  Scale, 
  RefreshCw, 
  CheckCircle2, 
  MapPin, 
  Clock, 
  Calendar
} from 'lucide-react';
import { StationWaterData, SolunarDayData } from './types/fishing';
import { 
  fetchAljmasStationData, 
  fetchBogojevoStationData, 
  getSolunarDataForDate,
  MVODOSTAJI_ALJMAS_URL,
  HIDMET_BOGOJEVO_URL
} from './services/weatherService';
import { Navbar } from './components/Navbar';
import { StationCardAljmas } from './components/StationCardAljmas';
import { StationCardBogojevo } from './components/StationCardBogojevo';
import { SolunarDailyDashboard } from './components/SolunarDailyDashboard';
import { StationsComparisonCard } from './components/StationsComparisonCard';
import { AndroidBottomNav } from './components/AndroidBottomNav';
import { OfflineIndicator } from './components/OfflineIndicator';

const STORAGE_KEY_LAST_UPDATE = 'dunav_info_zadnje_azuriranje';

export default function App() {
  const [activeTab, setActiveTab] = useState<'sve' | 'aljmas' | 'bogojevo' | 'solunar' | 'usporedba'>('sve');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LAST_UPDATE);
      if (saved) return new Date(saved);
    } catch {}
    return new Date();
  });

  // Početno stanje za Aljmaš (mvodostaji.voda.hr)
  const [aljmasData, setAljmasData] = useState<StationWaterData>({
    id: 'aljmas',
    name: 'Dunav - Aljmaš (Ušće Drave)',
    river: 'Dunav',
    sectorName: 'Sektor 2 / Ušće Drave u Dunav (Šporanj)',
    riverKm: 'rkm 1380,300',
    waterLevelCm: -96,
    waterLevelTrend: 'stagnira',
    waterLevelChangeCm: 0,
    timeOfMeasurement: '12:00',
    dateOfMeasurement: new Date().toLocaleDateString('hr-HR'),
    maxLevelCm: 820,
    maxLevelDate: '25.06.1965.',
    prepLevelCm: 400,
    recentHistory: [
      { date: new Date().toLocaleDateString('hr-HR'), time: '12:00', level: -96, trendChange: 0 },
      { date: new Date().toLocaleDateString('hr-HR'), time: '11:00', level: -96, trendChange: 0 },
      { date: new Date().toLocaleDateString('hr-HR'), time: '10:00', level: -96, trendChange: 0 },
      { date: new Date().toLocaleDateString('hr-HR'), time: '09:00', level: -95, trendChange: -1 },
      { date: new Date().toLocaleDateString('hr-HR'), time: '08:00', level: -95, trendChange: 0 }
    ],
    airPressureHpa: 1017,
    airPressureTrend: 'stabilan',
    airTempC: 21.0,
    waterTempC: 16.5,
    windSpeedKmh: 12,
    windDirection: 'SZ',
    weatherCondition: 'djelomicno_oblacno',
    sourceUrl: MVODOSTAJI_ALJMAS_URL,
    sourceName: 'mvodostaji.voda.hr (postaja 148)',
    isLive: true
  });

  // Početno stanje za Bogojevo (hidmet.gov.rs)
  const [bogojevoData, setBogojevoData] = useState<StationWaterData>({
    id: 'bogojevo',
    name: 'Dunav - Bogojevo',
    river: 'Dunav',
    sectorName: 'Most Bogojevo - Erdut / Kameni špornjevi',
    riverKm: 'rkm 1367,000',
    waterLevelCm: -106,
    waterLevelTrend: 'u_porastu',
    waterLevelChangeCm: 10,
    flowM3s: 880,
    forecastDays: [-92, -86, -90, -96],
    regularDefenseCm: 600,
    emergencyDefenseCm: 700,
    timeOfMeasurement: '07:00',
    dateOfMeasurement: new Date().toLocaleDateString('hr-HR'),
    recentHistory: [
      { date: new Date().toLocaleDateString('hr-HR'), time: '07:00', level: -106, trendChange: 10 },
      { date: 'Jučer', time: '07:00', level: -116, trendChange: 4 }
    ],
    airPressureHpa: 1016,
    airPressureTrend: 'stabilan',
    airTempC: 22.0,
    waterTempC: 17.5,
    windSpeedKmh: 10,
    windDirection: 'SZ',
    weatherCondition: 'djelomicno_oblacno',
    sourceUrl: HIDMET_BOGOJEVO_URL,
    sourceName: 'hidmet.gov.rs (hm_id 42020)',
    isLive: true
  });

  // Solunarni rezultati za danas
  const [solunarData, setSolunarData] = useState<SolunarDayData>(() => {
    return getSolunarDataForDate(new Date(), 1017, 'stabilan');
  });

  // Glavna funkcija za osvježavanje svih podataka
  const handleRefreshAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [alj, bog] = await Promise.all([
        fetchAljmasStationData(),
        fetchBogojevoStationData()
      ]);

      setAljmasData(alj);
      setBogojevoData(bog);

      // Ažuriranje solunara na temelju najsvježijeg barometra
      const updatedSolunar = getSolunarDataForDate(
        new Date(),
        alj.airPressureHpa || 1017,
        alj.airPressureTrend || 'stabilan'
      );
      setSolunarData(updatedSolunar);

      const now = new Date();
      setLastUpdated(now);
      try {
        localStorage.setItem(STORAGE_KEY_LAST_UPDATE, now.toISOString());
      } catch {}
    } catch (err) {
      console.error('Greška pri ažuriranju podataka:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Automatsko početno učitavanje
  useEffect(() => {
    handleRefreshAll();
  }, [handleRefreshAll]);

  const formatHoursShort = (date: Date | null) => {
    if (!date) return '--:--';
    return date.toLocaleTimeString('hr-HR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans pb-20 md:pb-10 selection:bg-cyan-500 selection:text-white w-full max-w-full overflow-x-hidden pt-[calc(4rem+max(env(safe-area-inset-top,0px),1.75rem))] sm:pt-[calc(4rem+max(env(safe-area-inset-top,0px),0.5rem))]">
      
      {/* Offline Status Badge */}
      <OfflineIndicator />

      {/* Navbar with single refresh button at the very top */}
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onRefresh={handleRefreshAll}
        isLoading={isLoading}
        lastUpdated={lastUpdated}
      />

      {/* Hero Header sa sažetkom stanja na Dunavu */}
      <div className="bg-gradient-to-b from-slate-900 to-slate-950 border-b border-slate-800/80 px-3 sm:px-6 lg:px-8 py-5 sm:py-6 w-full max-w-full overflow-hidden">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-4 w-full">
          
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap text-xs text-cyan-400 font-bold mb-1.5">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" /> Dunav (Aljmaš & Bogojevo)
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 font-mono text-slate-300">
                <Calendar className="w-3.5 h-3.5 text-slate-400" /> {solunarData.formattedDate}
              </span>
            </div>

            <h1 className="text-xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight break-words">
              Hidrometeo & Solunarni Centar Dunava
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Službeni podaci vodostaja preuzeti sa stranica <strong>mvodostaji.voda.hr</strong> (Aljmaš) i <strong>hidmet.gov.rs</strong> (Bogojevo) s dnevnim solunarnim rezultatima za ribolov.
            </p>
          </div>

          {/* Brzi sažetak kote u headeru - potpuno responzivan za sve mobitele */}
          <div className="grid grid-cols-3 gap-2 w-full lg:w-auto shrink-0">
            <div className="bg-slate-900/90 border border-teal-500/40 rounded-2xl p-2 sm:p-3 flex flex-col sm:flex-row items-center text-center sm:text-left gap-1.5 sm:gap-3 shadow-md min-w-0">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-teal-500/20 text-teal-300 flex items-center justify-center font-bold text-xs shrink-0">
                ALJ
              </div>
              <div className="min-w-0">
                <span className="text-[9px] sm:text-[10px] text-slate-400 block font-semibold truncate">Aljmaš</span>
                <span className="text-base sm:text-lg font-black text-white font-mono leading-none block">
                  {aljmasData.waterLevelCm} cm
                </span>
                <span className="text-[9px] sm:text-[10px] text-teal-300 block capitalize truncate">
                  {aljmasData.waterLevelTrend}
                </span>
              </div>
            </div>

            <div className="bg-slate-900/90 border border-cyan-500/40 rounded-2xl p-2 sm:p-3 flex flex-col sm:flex-row items-center text-center sm:text-left gap-1.5 sm:gap-3 shadow-md min-w-0">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-bold text-xs shrink-0">
                BOG
              </div>
              <div className="min-w-0">
                <span className="text-[9px] sm:text-[10px] text-slate-400 block font-semibold truncate">Bogojevo</span>
                <span className="text-base sm:text-lg font-black text-white font-mono leading-none block">
                  {bogojevoData.waterLevelCm} cm
                </span>
                <span className="text-[9px] sm:text-[10px] text-cyan-300 block capitalize truncate">
                  {bogojevoData.waterLevelTrend}
                </span>
              </div>
            </div>

            <div className="bg-slate-900/90 border border-indigo-500/40 rounded-2xl p-2 sm:p-3 flex flex-col sm:flex-row items-center text-center sm:text-left gap-1.5 sm:gap-3 shadow-md min-w-0">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold text-xs shrink-0">
                SOL
              </div>
              <div className="min-w-0">
                <span className="text-[9px] sm:text-[10px] text-slate-400 block font-semibold truncate">Solunar</span>
                <span className="text-base sm:text-lg font-black text-amber-400 leading-none block">
                  {solunarData.overallScore}/5★
                </span>
                <span className="text-[9px] sm:text-[10px] text-indigo-300 block truncate">
                  {solunarData.activityPercentage}%
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Glavni sadržaj */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-6 sm:space-y-8 flex-1 w-full max-w-full overflow-hidden">
        
        {/* Odabir prikaza lokacija (tabovi) na vrhu sadržaja */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-2 w-full">
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto py-1 max-w-full">
            <button
              onClick={() => setActiveTab('sve')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'sve'
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
              }`}
            >
              Kompletan prikaz
            </button>
            <button
              onClick={() => setActiveTab('solunar')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'solunar'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
              }`}
            >
              🌙 Dnevni Solunar
            </button>
            <button
              onClick={() => setActiveTab('aljmas')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'aljmas'
                  ? 'bg-teal-600 text-white shadow-md'
                  : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
              }`}
            >
              🌊 Aljmaš (mvodostaji)
            </button>
            <button
              onClick={() => setActiveTab('bogojevo')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'bogojevo'
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
              }`}
            >
              🌊 Bogojevo (hidmet)
            </button>
            <button
              onClick={() => setActiveTab('usporedba')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'usporedba'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
              }`}
            >
              ⚖️ Usporedba
            </button>
          </div>

          {/* Indikator statusa zadnjeg ažuriranja */}
          <div className="text-xs text-slate-400 flex items-center gap-1.5 font-medium ml-auto">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="whitespace-nowrap">Ažurirano: <strong>{formatHoursShort(lastUpdated)}</strong> h</span>
          </div>
        </div>

        {/* 1. Solunarni rezultati za taj dan */}
        {(activeTab === 'sve' || activeTab === 'solunar') && (
          <SolunarDailyDashboard 
            solunar={solunarData} 
            isLoading={isLoading} 
          />
        )}

        {/* 2. Dunav - Aljmaš (mvodostaji.voda.hr) */}
        {(activeTab === 'sve' || activeTab === 'aljmas') && (
          <StationCardAljmas 
            data={aljmasData} 
            isLoading={isLoading} 
          />
        )}

        {/* 3. Dunav - Bogojevo (hidmet.gov.rs) */}
        {(activeTab === 'sve' || activeTab === 'bogojevo') && (
          <StationCardBogojevo 
            data={bogojevoData} 
            isLoading={isLoading} 
          />
        )}

        {/* 4. Usporedba Aljmaš vs Bogojevo */}
        {(activeTab === 'sve' || activeTab === 'usporedba') && (
          <StationsComparisonCard 
            aljmas={aljmasData} 
            bogojevo={bogojevoData} 
          />
        )}

      </main>

      {/* Android Native Bottom Navigation Bar for Mobile with direct 5 tabs */}
      <AndroidBottomNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
      />

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-900/60 py-6 mt-10 text-center text-xs text-slate-400 w-full max-w-full overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <div className="text-slate-300 font-semibold tracking-wide">
            RiboPrognoza created by Daniel Čizmar
          </div>
          <div className="text-slate-500 font-medium">
            All rights reserved
          </div>
        </div>
      </footer>

    </div>
  );
}
