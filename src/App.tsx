import React, { useState, useEffect, useCallback } from 'react';
import { 
  Waves, 
  Sparkles, 
  Scale, 
  RefreshCw, 
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
import { BasicOverviewView } from './components/BasicOverviewView';
import { AndroidBottomNav } from './components/AndroidBottomNav';
import { OfflineIndicator } from './components/OfflineIndicator';
import { ActivationLockScreen } from './components/ActivationLockScreen';
import { AdminKeyGeneratorModal } from './components/AdminKeyGeneratorModal';
import { AppUpdateModal } from './components/AppUpdateModal';
import { DonationModal } from './components/DonationModal';
import { FishingChatModal } from './components/FishingChatModal';
import { isAppActivated, verifyLicenseWithServer } from './services/licenseService';
import { 
  checkForAppUpdate, 
  AppVersionInfo, 
  CURRENT_APP_VERSION,
  cleanupInstallationFiles
} from './services/updateService';

const STORAGE_KEY_LAST_UPDATE = 'dunav_info_zadnje_azuriranje';

export default function App() {
  const [isActivated, setIsActivated] = useState<boolean>(() => isAppActivated());
  const [showAdminModal, setShowAdminModal] = useState<boolean>(false);
  const [showDonationModal, setShowDonationModal] = useState<boolean>(false);
  const [showChatModal, setShowChatModal] = useState<boolean>(false);

  // Stanja za automatska ažuriranja
  const [availableUpdate, setAvailableUpdate] = useState<AppVersionInfo | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState<boolean>(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState<boolean>(false);
  const [manualUpdateToast, setManualUpdateToast] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'sve' | 'aljmas' | 'bogojevo' | 'solunar' | 'usporedba'>('sve');
  const [viewMode, setViewMode] = useState<'basic' | 'expert'>(() => {
    try {
      const saved = localStorage.getItem('ribo_app_view_mode');
      if (saved === 'expert' || saved === 'basic') return saved;
    } catch {}
    return 'basic'; // Zadani način pri pokretanju je pojednostavljena verzija
  });
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
    waterLevelCm: -76,
    waterLevelTrend: 'stagnira',
    waterLevelChangeCm: 0,
    timeOfMeasurement: '09:00',
    dateOfMeasurement: new Date().toLocaleDateString('hr-HR'),
    maxLevelCm: 820,
    maxLevelDate: '25.06.1965.',
    prepLevelCm: 400,
    recentHistory: [
      { date: new Date().toLocaleDateString('hr-HR'), time: '09:00', level: -76, trendChange: 0 },
      { date: new Date().toLocaleDateString('hr-HR'), time: '08:00', level: -76, trendChange: 0 },
      { date: new Date().toLocaleDateString('hr-HR'), time: '07:00', level: -76, trendChange: 0 },
      { date: new Date().toLocaleDateString('hr-HR'), time: '06:00', level: -76, trendChange: 0 },
      { date: new Date().toLocaleDateString('hr-HR'), time: '05:00', level: -76, trendChange: 0 }
    ],
    airPressureHpa: 1017,
    airPressureTrend: 'stabilan',
    airTempC: 21.0,
    waterTempC: 12.9,
    windSpeedKmh: 12,
    windSpeedMs: 3.3,
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
    waterLevelCm: -83,
    waterLevelTrend: 'opada',
    waterLevelChangeCm: -1,
    flowM3s: 880,
    forecastDays: [-92, -86, -90, -96],
    regularDefenseCm: 600,
    emergencyDefenseCm: 700,
    timeOfMeasurement: '07:00',
    dateOfMeasurement: new Date().toLocaleDateString('hr-HR'),
    recentHistory: [
      { date: new Date().toLocaleDateString('hr-HR'), time: '07:00', level: -83, trendChange: -1 },
      { date: 'Jučer', time: '07:00', level: -82, trendChange: 4 }
    ],
    airPressureHpa: 1016,
    airPressureTrend: 'stabilan',
    airTempC: 22.0,
    waterTempC: 12.6,
    windSpeedKmh: 10,
    windSpeedMs: 2.8,
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

  // Automatska tiha provjera nadogradnje i čišćenje starih instalacijskih datoteka pri pokretanju
  useEffect(() => {
    // Odmah pokreni automatsko čišćenje privremenih APK instalacijskih datoteka s uređaja
    cleanupInstallationFiles().catch(() => {});

    const timer = setTimeout(async () => {
      try {
        const res = await checkForAppUpdate(false);
        if (res.status === 'update_available' && res.updateInfo) {
          setAvailableUpdate(res.updateInfo);
          setShowUpdateModal(true);
        }
      } catch {}
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  // Redovita provjera valjanosti i opoziva licence s centralnim poslužiteljem
  useEffect(() => {
    if (!isActivated) return;

    const checkStatus = async () => {
      try {
        const result = await verifyLicenseWithServer();
        if (!result.valid && result.status === 'revoked') {
          setIsActivated(false);
        }
      } catch {}
    };

    // Provjeri pri učitavanju
    checkStatus();

    // I periodički svakih 35 sekundi ako je korisnik online
    const interval = setInterval(checkStatus, 35000);
    return () => clearInterval(interval);
  }, [isActivated]);

  // Ručna provjera nadogradnji (iz footera ili postavki)
  const handleManualCheckUpdate = async () => {
    setIsCheckingUpdate(true);
    setManualUpdateToast(null);
    try {
      const res = await checkForAppUpdate(true);
      if (res.status === 'update_available' && res.updateInfo) {
        setAvailableUpdate(res.updateInfo);
        setShowUpdateModal(true);
      } else if (res.status === 'up_to_date') {
        setManualUpdateToast(`✓ Imate najnoviju verziju (v${CURRENT_APP_VERSION})`);
        setTimeout(() => setManualUpdateToast(null), 3500);
      } else {
        setManualUpdateToast(`⚠️ ${res.errorMessage || 'Greška pri provjeri poslužitelja'}`);
        setTimeout(() => setManualUpdateToast(null), 4500);
      }
    } catch {
      setManualUpdateToast('⚠️ Nije moguće provjeriti nadogradnju (provjerite internet)');
      setTimeout(() => setManualUpdateToast(null), 4000);
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleScrollToChapter = (chapterId: string) => {
    if (viewMode !== 'expert') {
      setViewMode('expert');
      localStorage.setItem('ribo_app_view_mode', 'expert');
    }
    if (activeTab !== 'sve') {
      setActiveTab('sve');
    }
    setTimeout(() => {
      const el = document.getElementById(chapterId);
      if (el) {
        const navbarOffset = 76;
        const elementPosition = el.getBoundingClientRect().top + window.pageYOffset;
        window.scrollTo({
          top: Math.max(0, elementPosition - navbarOffset),
          behavior: 'smooth'
        });
      }
    }, 80);
  };

  const handleOpenExpertSection = (sectionId?: string) => {
    setViewMode('expert');
    localStorage.setItem('ribo_app_view_mode', 'expert');
    if (sectionId) {
      handleScrollToChapter(sectionId);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
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
          onTestUpdatePopup={(fakeInfo) => {
            setAvailableUpdate(fakeInfo);
            setShowUpdateModal(true);
          }}
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
        onOpenChat={() => setShowChatModal(true)}
      />

      {/* Hero Header sa sažetkom stanja na Dunavu */}
      <div className="bg-gradient-to-b from-slate-900 to-slate-950 border-b border-slate-800/80 px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3.5 w-full max-w-full overflow-hidden">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 sm:gap-3.5 w-full">
          
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap text-xs text-cyan-400 font-bold mb-1">
              <span className="flex items-center gap-1.5 font-mono text-slate-300">
                <Calendar className="w-3.5 h-3.5 text-cyan-400" /> {solunarData.formattedDate}
              </span>
            </div>

            <h1 className="text-xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight break-words">
              Hidrometeo & Solunarni Centar Dunava
            </h1>

            {/* Odabir načina prikaza: Osnovni mod vs Ekspertni mod (podignuto na visinu blinkajućeg teksta) */}
            <div className="mt-2 sm:mt-2.5 flex items-center gap-2.5 flex-wrap">
              <div className="inline-flex p-1 bg-slate-950/90 rounded-2xl border border-slate-800 shadow-inner">
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('basic');
                    localStorage.setItem('ribo_app_view_mode', 'basic');
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    viewMode === 'basic'
                      ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-950 shadow-md font-black'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span>⚡ Osnovni mod</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('expert');
                    localStorage.setItem('ribo_app_view_mode', 'expert');
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    viewMode === 'expert'
                      ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-md font-black'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span>🎯 Ekspertni mod (Pro)</span>
                </button>
              </div>

              <span className="text-[11px] text-slate-400 hidden sm:inline-block">
                {viewMode === 'basic' ? 'Pojednostavljeni brzi pregled za vodu' : 'Puni ribolovni centar s grafikonima i savjetima'}
              </span>
            </div>
          </div>

          {/* Brzi sažetak kote u headeru - interaktivni gumbovi za skok na poglavlja (u Ekspertnom modu) */}
          {viewMode === 'expert' && (
            <div className="grid grid-cols-3 gap-2 w-full lg:w-auto shrink-0 animate-fadeIn">
              {/* ALJMAŠ GUMB */}
              <button
                type="button"
                onClick={() => handleScrollToChapter('sekcija-aljmas')}
                className="bg-slate-900/90 hover:bg-slate-850 border border-teal-500/40 hover:border-teal-400 active:scale-95 transition-all rounded-2xl p-2 sm:p-3 flex flex-col items-center sm:items-start text-center sm:text-left justify-between shadow-md min-w-0 cursor-pointer group"
                title="Klikni za skok na poglavlje DUNAV - Aljmaš"
              >
                <span className="w-full text-center sm:text-left font-black text-teal-300 group-hover:text-teal-200 text-xs sm:text-sm tracking-wider uppercase truncate">
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
              </button>

              {/* BOGOJEVO GUMB */}
              <button
                type="button"
                onClick={() => handleScrollToChapter('sekcija-bogojevo')}
                className="bg-slate-900/90 hover:bg-slate-850 border border-cyan-500/40 hover:border-cyan-400 active:scale-95 transition-all rounded-2xl p-2 sm:p-3 flex flex-col items-center sm:items-start text-center sm:text-left justify-between shadow-md min-w-0 cursor-pointer group"
                title="Klikni za skok na poglavlje DUNAV - Bogojevo"
              >
                <span className="w-full text-center sm:text-left font-black text-cyan-300 group-hover:text-cyan-200 text-xs sm:text-sm tracking-wider uppercase truncate">
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
              </button>

              {/* SOLUNAR GUMB */}
              <button
                type="button"
                onClick={() => handleScrollToChapter('sekcija-solunar')}
                className="bg-slate-900/90 hover:bg-slate-850 border border-indigo-500/40 hover:border-indigo-400 active:scale-95 transition-all rounded-2xl p-2 sm:p-3 flex flex-col items-center sm:items-start text-center sm:text-left justify-between shadow-md min-w-0 cursor-pointer group"
                title="Klikni za skok na poglavlje Solunarni rezultati"
              >
                <span className="w-full text-center sm:text-left font-black text-indigo-300 group-hover:text-indigo-200 text-xs sm:text-sm tracking-wider uppercase truncate">
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
              </button>
            </div>
          )}

        </div>
      </div>

      {/* Glavni sadržaj */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2 sm:py-3.5 flex-1 w-full max-w-full overflow-hidden">
        
        {viewMode === 'basic' ? (
          /* POJEDNOSTAVLJENI OSNOVNI PRIKAZ NA POKRETANJU */
          <BasicOverviewView 
            aljmas={aljmasData} 
            bogojevo={bogojevoData} 
            solunar={solunarData} 
            isLoading={isLoading} 
            onOpenExpertSection={handleOpenExpertSection}
          />
        ) : (
          /* DUBINSKI EKSPERTNI RIBOLOVNI MOD */
          <div className="space-y-6 sm:space-y-8 animate-fadeIn">
            {/* Odabir prikaza lokacija (tabovi) na vrhu sadržaja */}
            <div className="border-b border-slate-800 pb-3 w-full">
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
                  🌊 Aljmaš
                </button>
                <button
                  onClick={() => setActiveTab('bogojevo')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === 'bogojevo'
                      ? 'bg-cyan-600 text-white shadow-md'
                      : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
                  }`}
                >
                  🌊 Bogojevo
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
            </div>

            {/* 1. Solunarni rezultati za taj dan */}
            {(activeTab === 'sve' || activeTab === 'solunar') && (
              <div id="sekcija-solunar" className="scroll-mt-20">
                <SolunarDailyDashboard 
                  solunar={solunarData} 
                  isLoading={isLoading} 
                />
              </div>
            )}

            {/* 2. Dunav - Aljmaš */}
            {(activeTab === 'sve' || activeTab === 'aljmas') && (
              <div id="sekcija-aljmas" className="scroll-mt-20">
                <StationCardAljmas 
                  data={aljmasData} 
                  isLoading={isLoading} 
                />
              </div>
            )}

            {/* 3. Dunav - Bogojevo */}
            {(activeTab === 'sve' || activeTab === 'bogojevo') && (
              <div id="sekcija-bogojevo" className="scroll-mt-20">
                <StationCardBogojevo 
                  data={bogojevoData} 
                  isLoading={isLoading} 
                />
              </div>
            )}

            {/* 4. Usporedba Aljmaš vs Bogojevo */}
            {(activeTab === 'sve' || activeTab === 'usporedba') && (
              <div id="sekcija-usporedba" className="scroll-mt-20">
                <StationsComparisonCard 
                  aljmas={aljmasData} 
                  bogojevo={bogojevoData} 
                />
              </div>
            )}

            {/* Podnožje ekspertnog moda: Gumb za brzi povratak na osnovni mod */}
            <div className="pt-4 pb-2 text-center">
              <button
                type="button"
                onClick={() => {
                  setViewMode('basic');
                  localStorage.setItem('ribo_app_view_mode', 'basic');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-slate-900 hover:bg-slate-850 text-teal-300 hover:text-white border border-teal-500/40 text-xs font-bold transition-all cursor-pointer active:scale-95 shadow-lg"
              >
                <span>⚡ Povratak na Osnovni mod (Brzi pregled)</span>
              </button>
            </div>
          </div>
        )}

      </main>

      {/* Android Native Bottom Navigation Bar for Mobile with direct 5 tabs */}
      <AndroidBottomNav
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          if (viewMode === 'basic') {
            setViewMode('expert');
            localStorage.setItem('ribo_app_view_mode', 'expert');
          }
        }}
      />

      {/* Podnožje: Donacije i podrška radu autora (premješteno s vrha u podnožje) */}
      <div className="max-w-7xl mx-auto px-4 w-full mt-4 mb-2 text-center">
        <div className="inline-flex items-center justify-center gap-1.5 sm:gap-2 py-2 px-3.5 sm:px-5 rounded-2xl bg-slate-900/90 border border-amber-500/30 text-[11px] sm:text-xs text-slate-300 animate-pulse shadow-lg flex-wrap">
          <span>Aplikacija je potpuno besplatna. Rad autora možete podržati neobaveznim donacijama za čevape i Colu </span>
          <button
            type="button"
            onClick={() => setShowDonationModal(true)}
            className="inline-flex items-center px-2 py-0.5 rounded bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-[10px] tracking-wider uppercase cursor-pointer shadow-sm active:scale-95 transition-transform border border-amber-300 ml-1"
            title="Donacija za podršku autoru"
          >
            DONACIJA
          </button>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-900/60 py-5 mt-4 text-center text-xs text-slate-400 w-full max-w-full overflow-hidden">
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
        onTestUpdatePopup={(fakeInfo) => {
          setAvailableUpdate(fakeInfo);
          setShowUpdateModal(true);
        }}
      />

      {/* Modal za obavijest o novoj verziji */}
      <AppUpdateModal
        updateInfo={availableUpdate}
        isOpen={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
      />

      {/* Modal za donaciju */}
      <DonationModal
        isOpen={showDonationModal}
        onClose={() => setShowDonationModal(false)}
      />

      {/* Modal za interni Dunavski ribički chat */}
      <FishingChatModal
        isOpen={showChatModal}
        onClose={() => setShowChatModal(false)}
      />

    </div>
  );
}
