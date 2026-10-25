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
import { ActivationLockScreen } from './components/ActivationLockScreen';
import { AdminKeyGeneratorModal } from './components/AdminKeyGeneratorModal';
import { AppUpdateModal } from './components/AppUpdateModal';
import { isAppActivated } from './services/licenseService';
import { 
  checkForAppUpdate, 
  AppVersionInfo, 
  CURRENT_APP_VERSION 
} from './services/updateService';

const STORAGE_KEY_LAST_UPDATE = 'dunav_info_zadnje_azuriranje';

export default function App() {
  const [isActivated, setIsActivated] = useState<boolean>(() => isAppActivated());
  const [showAdminModal, setShowAdminModal] = useState<boolean>(false);

  // Stanja za automatska ažuriranja
  const [availableUpdate, setAvailableUpdate] = useState<AppVersionInfo | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState<boolean>(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState<boolean>(false);
  const [manualUpdateToast, setManualUpdateToast] = useState<string | null>(null);

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

  // Automatsko početno učitavanje podataka
  useEffect(() => {
    handleRefreshAll();
  }, [handleRefreshAll]);

  // Automatska tiha provjera nadogradnje pri pokretanju (nakon 1.5 sekundi)
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const update = await checkForAppUpdate(false);
        if (update) {
          setAvailableUpdate(update);
          setShowUpdateModal(true);
        }
      } catch {}
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  // Ručna provjera nadogradnji (iz footera ili postavki)
  const handleManualCheckUpdate = async () => {
    setIsCheckingUpdate(true);
    setManualUpdateToast(null);
    try {
      const update = await checkForAppUpdate(true);
      if (update) {
        setAvailableUpdate(update);
        setShowUpdateModal(true);
      } else {
        setManualUpdateToast(`Imate najnoviju verziju (v${CURRENT_APP_VERSION})`);
        setTimeout(() => setManualUpdateToast(null), 3500);
      }
    } catch {
      setManualUpdateToast('Nije moguće provjeriti nadogradnju (provjerite internet)');
      setTimeout(() => setManualUpdateToast(null), 3500);
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const formatHoursShort = (date: Date | null) => {
    if (!date) return '--:--';
    return date.toLocaleTimeString('hr-HR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isActivated) {
    return (
      <>
        <ActivationLockScreen
          onActivated={() => setIsActivated(true)}
          onOpenAdminGenerator={() => setShowAdminModal(true)}
        />
        <AdminKeyGeneratorModal
          isOpen={showAdminModal}
          onClose={() => setShowAdminModal(false)}
          onSelfActivated={() => setIsActivated(true)}
        />
        <AppUpdateModal
          updateInfo={availableUpdate}
          isOpen={showUpdateModal}
          onClose={() => setShowUpdateModal(false)}
        />
      </>
    );
  }

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
            {/* ALJMAŠ */}
            <div className="bg-slate-900/90 border border-teal-500/40 rounded-2xl p-2 sm:p-3 flex flex-col items-center sm:items-start text-center sm:text-left justify-between shadow-md min-w-0">
              <span className="w-full text-center sm:text-left font-black text-teal-300 text-xs sm:text-sm tracking-wider uppercase truncate">
                ALJMAŠ
              </span>
              <div className="mt-1 w-full">
                <span className="text-base sm:text-lg font-black text-white font-mono leading-none block">
                  {aljmasData.waterLevelCm} cm
                </span>
                <span className="text-[10px] sm:text-xs text-teal-300 block capitalize truncate font-medium mt-0.5">
                  {aljmasData.waterLevelTrend}
                </span>
              </div>
            </div>

            {/* BOGOJEVO */}
            <div className="bg-slate-900/90 border border-cyan-500/40 rounded-2xl p-2 sm:p-3 flex flex-col items-center sm:items-start text-center sm:text-left justify-between shadow-md min-w-0">
              <span className="w-full text-center sm:text-left font-black text-cyan-300 text-xs sm:text-sm tracking-wider uppercase truncate">
                BOGOJEVO
              </span>
              <div className="mt-1 w-full">
                <span className="text-base sm:text-lg font-black text-white font-mono leading-none block">
                  {bogojevoData.waterLevelCm} cm
                </span>
                <span className="text-[10px] sm:text-xs text-cyan-300 block capitalize truncate font-medium mt-0.5">
                  {bogojevoData.waterLevelTrend}
                </span>
              </div>
            </div>

            {/* SOLUNAR */}
            <div className="bg-slate-900/90 border border-indigo-500/40 rounded-2xl p-2 sm:p-3 flex flex-col items-center sm:items-start text-center sm:text-left justify-between shadow-md min-w-0">
              <span className="w-full text-center sm:text-left font-black text-indigo-300 text-xs sm:text-sm tracking-wider uppercase truncate">
                SOLUNAR
              </span>
              <div className="mt-1 w-full">
                <span className="text-base sm:text-lg font-black text-amber-400 leading-none block">
                  {solunarData.overallScore}/5★
                </span>
                <span className="text-[10px] sm:text-xs text-indigo-300 block truncate font-medium mt-0.5">
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
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <button 
            type="button"
            onClick={() => setShowAdminModal(true)} 
            className="text-slate-300 hover:text-amber-400 transition-colors font-semibold tracking-wide cursor-pointer text-left"
            title="Generator ključeva (Daniel Čizmar)"
          >
            RiboPrognoza created by Daniel Čizmar
          </button>

          {/* Gumb za provjeru nadogradnje i verzija */}
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <button
              onClick={handleManualCheckUpdate}
              disabled={isCheckingUpdate}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700/60 text-slate-300 hover:text-cyan-300 font-mono text-[11px] transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Provjeri postoji li novija verzija"
            >
              <RefreshCw className={`w-3 h-3 ${isCheckingUpdate ? 'animate-spin text-cyan-400' : ''}`} />
              <span>v{CURRENT_APP_VERSION} • Provjeri ažuriranje</span>
            </button>
            {manualUpdateToast && (
              <span className="text-[11px] text-teal-400 font-medium">
                {manualUpdateToast}
              </span>
            )}
          </div>

          <div className="text-slate-500 font-medium">
            All rights reserved
          </div>
        </div>
      </footer>

      {/* Admin modal kada je aplikacija već otključana */}
      <AdminKeyGeneratorModal
        isOpen={showAdminModal}
        onClose={() => setShowAdminModal(false)}
      />

      {/* Modal za obavijest o novoj verziji */}
      <AppUpdateModal
        updateInfo={availableUpdate}
        isOpen={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
      />

    </div>
  );
}
