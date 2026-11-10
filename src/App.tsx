import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  getStoredAljmasData,
  getStoredBogojevoData,
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
import { LovostajModal } from './components/LovostajModal';
import { CatchLogModal } from './components/CatchLogModal';
import { EdgeSwipeBackGesture } from './components/EdgeSwipeBackGesture';
import { ModalErrorBoundary } from './components/ModalErrorBoundary';
import { isAppActivated, verifyLicenseWithServer, getDeviceId } from './services/licenseService';
import { 
  fetchChatMessages, 
  subscribeToChatMessages,
  getUnreadChatCount, 
  markChatAsRead 
} from './services/chatService';
import { 
  showIncomingMessageNotification, 
  requestNotificationPermission, 
  updateAppBadge 
} from './services/notificationService';
import { 
  syncDeviceIdToNative, 
  setNativeInChatStatus,
  syncLastSeenMessageToNative
} from './services/nativeNotifierService';
import { LocalNotifications } from '@capacitor/local-notifications';
import { 
  checkForAppUpdate, 
  AppVersionInfo, 
  getCurrentAppVersion,
  applyLiveWebUpdate,
  cleanupInstallationFiles,
  subscribeToLiveUpdates
} from './services/updateService';

const STORAGE_KEY_LAST_UPDATE = 'dunav_info_zadnje_azuriranje';

export default function App() {
  const [isActivated, setIsActivated] = useState<boolean>(() => isAppActivated());
  const [showAdminModal, setShowAdminModal] = useState<boolean>(false);
  const [showDonationModal, setShowDonationModal] = useState<boolean>(false);
  const [showChatModal, setShowChatModal] = useState<boolean>(false);
  const [showLovostajModal, setShowLovostajModal] = useState<boolean>(false);
  const [showCatchLogModal, setShowCatchLogModal] = useState<boolean>(false);
  const [unreadChatCount, setUnreadChatCount] = useState<number>(0);

  // Stanja za automatska Live Web ažuriranja
  const [activeAppVersion, setActiveAppVersion] = useState<string>(() => getCurrentAppVersion());
  const [availableUpdate, setAvailableUpdate] = useState<AppVersionInfo | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState<boolean>(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState<boolean>(false);
  const [manualUpdateToast, setManualUpdateToast] = useState<string | null>(null);
  const [liveUpdateBanner, setLiveUpdateBanner] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'sve' | 'aljmas' | 'bogojevo' | 'solunar' | 'usporedba'>('sve');
  // Aplikacija se pri svakom ponovnom pokretanju uvijek otvara u Osnovnom modu
  const [viewMode, setViewMode] = useState<'basic' | 'expert'>('basic');
  const [highContrast, setHighContrast] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ribo_high_contrast_mode') === 'true';
    } catch {
      return false;
    }
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [pullDistance, setPullDistance] = useState<number>(0);
  const pullStartYRef = useRef<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LAST_UPDATE);
      if (saved) return new Date(saved);
    } catch {}
    return new Date();
  });

  const handleToggleHighContrast = () => {
    setHighContrast(prev => {
      const next = !prev;
      try {
        localStorage.setItem('ribo_high_contrast_mode', String(next));
      } catch {}
      return next;
    });
  };

  // Početno stanje za Aljmaš (mvodostaji.voda.hr) - učitava iz predmemorije za trenutnu usklađenost
  const [aljmasData, setAljmasData] = useState<StationWaterData>(() => {
    const cached = getStoredAljmasData();
    if (cached) return cached;
    return {
      id: 'aljmas',
      name: 'Dunav - Aljmaš (Ušće Drave)',
      river: 'Dunav',
      sectorName: 'Sektor 2 / Ušće Drave u Dunav (Šporanj)',
      riverKm: 'rkm 1380,300',
      waterLevelCm: -70,
      waterLevelTrend: 'stagnira',
      waterLevelChangeCm: 0,
      timeOfMeasurement: '14:00',
      dateOfMeasurement: new Date().toLocaleDateString('hr-HR'),
      maxLevelCm: 820,
      maxLevelDate: '25.06.1965.',
      prepLevelCm: 400,
      recentHistory: [
        { date: new Date().toLocaleDateString('hr-HR'), time: '14:00', level: -70, trendChange: 0 },
        { date: new Date().toLocaleDateString('hr-HR'), time: '13:00', level: -70, trendChange: 0 },
        { date: new Date().toLocaleDateString('hr-HR'), time: '12:00', level: -70, trendChange: 0 }
      ],
      airPressureHpa: 1025,
      airPressureTrend: 'rast',
      airTempC: 11.4,
      waterTempC: 9.8,
      windSpeedKmh: 12,
      windSpeedMs: 3.3,
      windDirection: 'SZ',
      weatherCondition: 'djelomicno_oblacno',
      sourceUrl: MVODOSTAJI_ALJMAS_URL,
      sourceName: 'mvodostaji.voda.hr (postaja 1582 - Aljmaš)',
      isLive: true
    };
  });

  // Početno stanje za Bogojevo (hidmet.gov.rs) - učitava iz predmemorije za trenutnu usklađenost
  const [bogojevoData, setBogojevoData] = useState<StationWaterData>(() => {
    const cached = getStoredBogojevoData();
    if (cached) return cached;
    return {
      id: 'bogojevo',
      name: 'Dunav - Bogojevo',
      river: 'Dunav',
      sectorName: 'Most Bogojevo - Erdut / Kameni špornjevi',
      riverKm: 'rkm 1367,000',
      waterLevelCm: -77,
      waterLevelTrend: 'opada',
      waterLevelChangeCm: -3,
      flowM3s: 1010,
      forecastDays: [-78, -76, -72, -74],
      regularDefenseCm: 600,
      emergencyDefenseCm: 700,
      timeOfMeasurement: '07:00',
      dateOfMeasurement: new Date().toLocaleDateString('hr-HR'),
      recentHistory: [
        { date: new Date().toLocaleDateString('hr-HR'), time: '07:00', level: -77, trendChange: -3 },
        { date: 'Jučer', time: '07:00', level: -74, trendChange: -3 }
      ],
      airPressureHpa: 1025,
      airPressureTrend: 'rast',
      airTempC: 9.3,
      waterTempC: 8.1,
      windSpeedKmh: 10,
      windSpeedMs: 2.8,
      windDirection: 'SZ',
      weatherCondition: 'djelomicno_oblacno',
      sourceUrl: HIDMET_BOGOJEVO_URL,
      sourceName: 'hidmet.gov.rs (hm_id 42020)',
      isLive: true
    };
  });

  // Solunarni rezultati za danas
  const [solunarData, setSolunarData] = useState<SolunarDayData>(() => {
    return getSolunarDataForDate(new Date(), 1021, 'stabilan');
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
        alj.airPressureHpa || 1021,
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

  // Automatska tiha provjera nadogradnje, Live Web sinkronizacija i čišćenje starih instalacijskih datoteka
  useEffect(() => {
    // Odmah pokreni automatsko čišćenje privremenih APK instalacijskih datoteka s uređaja
    cleanupInstallationFiles().catch(() => {});

    const handleAutoApplyUpdate = async (newUpdate: AppVersionInfo) => {
      try {
        const cleanVer = String(newUpdate.version || '').replace(/^[vV]/, '').trim();
        const bannerKey = `ribo_ota_banner_shown_${cleanVer}`;
        if (localStorage.getItem(bannerKey) === 'true') {
          setActiveAppVersion(getCurrentAppVersion());
          return;
        }
        localStorage.setItem(bannerKey, 'true');

        const res = await applyLiveWebUpdate(newUpdate.version, newUpdate.changelog);
        if (res.success) {
          setActiveAppVersion(res.version);
          setAvailableUpdate(null);
          setShowUpdateModal(false);
          setLiveUpdateBanner(`⚡ Live Web Ažuriranje: Aplikacija je automatski nadograđena na v${res.version}`);
          setTimeout(() => setLiveUpdateBanner(null), 4000);
          handleRefreshAll();
        }
      } catch {}
    };

    const onLiveUpdateEvent = (e: any) => {
      if (e?.detail?.version) {
        setActiveAppVersion(e.detail.version);
      } else {
        setActiveAppVersion(getCurrentAppVersion());
      }
    };
    window.addEventListener('ribo-live-update-applied', onLiveUpdateEvent);

    // 1. Pretplata na Live Web ažuriranja u stvarnom vremenu putem Firestorea (automatska instalacija odmah)
    const unsubLive = subscribeToLiveUpdates((newUpdate) => {
      handleAutoApplyUpdate(newUpdate);
    });

    // 2. Provjera i automatska instalacija Live Web ažuriranja pri samom pokretanju aplikacije
    const checkUpdates = async () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      try {
        const res = await checkForAppUpdate(false);
        if (res.status === 'update_available' && res.updateInfo) {
          await handleAutoApplyUpdate(res.updateInfo);
        } else {
          setActiveAppVersion(getCurrentAppVersion());
        }
      } catch {}
    };

    const timer = setTimeout(checkUpdates, 800);
    // Periodička provjera svakih 15 minuta isključivo dok je zaslon aktivan
    const interval = setInterval(checkUpdates, 15 * 60 * 1000);

    // 3. Provjera kada se korisnik vrati u aplikaciju
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkUpdates();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('ribo-live-update-applied', onLiveUpdateEvent);
      unsubLive();
    };
  }, [handleRefreshAll]);

  // Redovita provjera valjanosti i opoziva licence s centralnim poslužiteljem (samo dok je aplikacija vidljiva na zaslonu)
  useEffect(() => {
    if (!isActivated) return;

    const checkStatus = async () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      try {
        const result = await verifyLicenseWithServer();
        if (!result.valid && result.status === 'revoked') {
          setIsActivated(false);
        }
      } catch {}
    };

    // Provjeri pri učitavanju
    checkStatus();

    // Provjeri svakih 5 minuta samo dok je zaslon uključen (sprječava buđenje u pozadini i trošenje baterije)
    const interval = setInterval(checkStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isActivated]);

  // Evidencija zadnje viđene poruke kako bi zvučna i sistemska obavijest svirale samo jednom za svaku novu poruku
  const lastNotifiedMsgIdRef = useRef<string>('');

  useEffect(() => {
    // Inicijalno zatraži dozvolu za prikaz obavijesti i zvuk (Android + PWA)
    requestNotificationPermission().catch(() => {});

    // Slušaj klik na obavijest na Android mobitelu kako bi odmah otvorio LiveChat
    let isMounted = true;
    try {
      LocalNotifications.addListener('localNotificationActionPerformed', () => {
        if (isMounted) {
          setShowChatModal(true);
        }
      });
    } catch {}

    const handleCheckPendingOpen = () => {
      try {
        if (localStorage.getItem('ribo_pending_open_chat_on_resume') === 'true') {
          localStorage.removeItem('ribo_pending_open_chat_on_resume');
          setShowChatModal(true);
        }
      } catch {}
    };

    window.addEventListener('focus', handleCheckPendingOpen);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        handleCheckPendingOpen();
      }
    });

    handleCheckPendingOpen();

    return () => {
      isMounted = false;
      window.removeEventListener('focus', handleCheckPendingOpen);
      try {
        LocalNotifications.removeAllListeners();
      } catch {}
    };
  }, []);

  const showChatModalRef = useRef<boolean>(showChatModal);
  useEffect(() => {
    showChatModalRef.current = showChatModal;
    setNativeInChatStatus(showChatModal);
  }, [showChatModal]);

  // Pretplata na poruke u stvarnom vremenu za zvučnu obavijest, obavijest na traci i ikoni aplikacije (App Badge)
  useEffect(() => {
    const myId = getDeviceId();
    syncDeviceIdToNative(myId);

    if (!isActivated) return;

    if (!lastNotifiedMsgIdRef.current && typeof window !== 'undefined') {
      lastNotifiedMsgIdRef.current = localStorage.getItem('ribo_last_notified_msg_id') || '';
    }

    let initialSyncDone = false;

    const unsubscribe = subscribeToChatMessages((res) => {
      if (res.chatBlocked) {
        setUnreadChatCount(0);
        updateAppBadge(0);
        return;
      }

      if (Array.isArray(res.messages)) {
        const count = getUnreadChatCount(res.messages, myId);
        setUnreadChatCount(count);
        updateAppBadge(count);

        // Pronađi najnoviju pristiglu poruku koju je poslao netko drugi
        const messagesFromOthers = res.messages.filter(m => m.deviceId !== myId);
        const newestMsg = messagesFromOthers[messagesFromOthers.length - 1];

        if (newestMsg) {
          if (initialSyncDone && count > 0 && newestMsg.id !== lastNotifiedMsgIdRef.current) {
            lastNotifiedMsgIdRef.current = newestMsg.id;
            try {
              localStorage.setItem('ribo_last_notified_msg_id', newestMsg.id);
            } catch {}

            // Ako korisnik u ovom trenutku nije unutar otvorenog chata, pošalji zvuk i sistemsku obavijest
            if (!showChatModalRef.current) {
              showIncomingMessageNotification(newestMsg.userName, newestMsg.text, newestMsg.id);
            } else {
              // Korisnik već gleda chat, pa tiho zabilježi poruku kao viđenu u nativnom servisu
              syncLastSeenMessageToNative(newestMsg.id, newestMsg.createdAt).catch(() => {});
            }

            // Ako je korisnik u tom trenutku bio izvan aplikacije, zabilježi da se pri povratku otvori LiveChat
            if (typeof document !== 'undefined' && document.hidden) {
              try {
                localStorage.setItem('ribo_pending_open_chat_on_resume', 'true');
              } catch {}
            }
          } else if (!lastNotifiedMsgIdRef.current) {
            lastNotifiedMsgIdRef.current = newestMsg.id;
            syncLastSeenMessageToNative(newestMsg.id, newestMsg.createdAt).catch(() => {});
            try {
              localStorage.setItem('ribo_last_notified_msg_id', newestMsg.id);
            } catch {}
          }
        }
      }
      initialSyncDone = true;
    });

    return () => unsubscribe();
  }, [isActivated]);

  const handleOpenChat = () => {
    setShowChatModal(true);
    setUnreadChatCount(0);
    markChatAsRead();
    updateAppBadge(0);
    setNativeInChatStatus(true);
    try {
      localStorage.removeItem('ribo_pending_open_chat_on_resume');
    } catch {}
  };

  const handleCloseChat = () => {
    setShowChatModal(false);
    setNativeInChatStatus(false);
    try {
      localStorage.removeItem('ribo_pending_open_chat_on_resume');
    } catch {}
  };

  // Provjera je li otvoren bilo koji modal ili je aktivan Pro mod
  const isAnyModalOpen = 
    showCatchLogModal || 
    showChatModal || 
    showLovostajModal || 
    showAdminModal || 
    showDonationModal || 
    showUpdateModal;

  const isAnySubSectionActive = isAnyModalOpen || viewMode === 'expert';

  // Središnja funkcija za povratak unatrag (identično kliku na 'X' ili povratku na Osnovni mod)
  const handleGlobalBack = useCallback(() => {
    // 1. Evidencija ulova
    if (showCatchLogModal) {
      setShowCatchLogModal(false);
      return;
    }
    // 2. LiveChat
    if (showChatModal) {
      handleCloseChat();
      return;
    }
    // 3. Lovostaj
    if (showLovostajModal) {
      setShowLovostajModal(false);
      return;
    }
    // 4. Admin kontrolni panel
    if (showAdminModal) {
      setShowAdminModal(false);
      return;
    }
    // 5. Donacije
    if (showDonationModal) {
      setShowDonationModal(false);
      return;
    }
    // 6. Modal ažuriranja
    if (showUpdateModal) {
      setShowUpdateModal(false);
      return;
    }
    // 7. Pro mod (povratak na Osnovni mod)
    if (viewMode === 'expert') {
      setViewMode('basic');
      try {
        localStorage.setItem('ribo_app_view_mode', 'basic');
      } catch {}
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
  }, [
    showCatchLogModal,
    showChatModal,
    showLovostajModal,
    showAdminModal,
    showDonationModal,
    showUpdateModal,
    viewMode
  ]);

  // Ručna provjera nadogradnji (iz footera ili postavki) - automatski primjenjuje Live Web ažuriranje
  const handleManualCheckUpdate = async () => {
    setIsCheckingUpdate(true);
    setManualUpdateToast(null);
    try {
      const res = await checkForAppUpdate(true);
      if (res.status === 'update_available' && res.updateInfo) {
        const applied = await applyLiveWebUpdate(res.updateInfo.version, res.updateInfo.changelog);
        setActiveAppVersion(applied.version);
        setManualUpdateToast(`⚡ Live Web ažuriranje (v${applied.version}) je automatski instalirano!`);
        setTimeout(() => setManualUpdateToast(null), 4500);
        handleRefreshAll();
      } else if (res.status === 'up_to_date') {
        const currentVer = getCurrentAppVersion();
        setActiveAppVersion(currentVer);
        setManualUpdateToast(`✓ Imate najnoviju Live Web verziju (v${currentVer})`);
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
        <EdgeSwipeBackGesture
          isActive={showAdminModal || showUpdateModal}
          onBack={handleGlobalBack}
          targetLabel="Zatvori"
        />
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

  const handleTouchStartPull = (e: React.TouchEvent) => {
    if (isAnyModalOpen || isLoading) return;
    if (window.scrollY <= 5) {
      pullStartYRef.current = e.touches[0].clientY;
    } else {
      pullStartYRef.current = null;
    }
  };

  const handleTouchMovePull = (e: React.TouchEvent) => {
    if (pullStartYRef.current === null || isAnyModalOpen || isLoading) return;
    if (window.scrollY > 5) {
      pullStartYRef.current = null;
      setPullDistance(0);
      return;
    }
    const diffY = e.touches[0].clientY - pullStartYRef.current;
    if (diffY > 12) {
      setPullDistance(Math.min(diffY * 0.45, 72));
    } else {
      setPullDistance(0);
    }
  };

  const handleTouchEndPull = () => {
    if (pullDistance >= 52 && !isLoading) {
      handleRefreshAll();
    }
    pullStartYRef.current = null;
    setPullDistance(0);
  };

  return (
    <div
      onTouchStart={handleTouchStartPull}
      onTouchMove={handleTouchMovePull}
      onTouchEnd={handleTouchEndPull}
      onTouchCancel={handleTouchEndPull}
      className={`min-h-screen ${highContrast ? 'bg-slate-900 text-white sunlight-active' : 'bg-slate-950 text-slate-100'} flex flex-col font-sans pb-20 md:pb-10 selection:bg-cyan-500 selection:text-white w-full max-w-full overflow-x-hidden pt-[calc(4.25rem+env(safe-area-inset-top,0px))] sm:pt-[calc(4.5rem+env(safe-area-inset-top,0px))]`}
    >
      
      {/* Detekcija gesti ruba ekrana i hardverskog gumba / strelice za povratak u Osnovni mod */}
      <EdgeSwipeBackGesture
        isActive={isAnySubSectionActive}
        onBack={handleGlobalBack}
        targetLabel="Osnovni mod"
      />

      {/* Offline Status Badge */}
      <OfflineIndicator />

      {/* Navbar */}
      <Navbar
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          setViewMode('expert');
          localStorage.setItem('ribo_app_view_mode', 'expert');
        }}
        onResetToBasic={() => {
          setViewMode('basic');
          localStorage.setItem('ribo_app_view_mode', 'basic');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onRefresh={handleRefreshAll}
        isLoading={isLoading}
        lastUpdated={lastUpdated}
        onOpenChat={handleOpenChat}
        unreadChatCount={unreadChatCount}
        highContrast={highContrast}
        onToggleHighContrast={handleToggleHighContrast}
      />

      {/* Pull-to-Refresh indikator na vrhu ekrana */}
      {pullDistance > 10 && (
        <div
          style={{ height: `${Math.round(pullDistance)}px` }}
          className="w-full flex items-center justify-center bg-slate-900/90 border-b border-cyan-500/30 text-xs font-bold text-cyan-300 overflow-hidden transition-all"
        >
          <div className="flex items-center gap-2">
            <RefreshCw className={`w-4 h-4 ${pullDistance >= 52 ? 'animate-spin text-teal-300' : 'text-cyan-400'}`} />
            <span>{pullDistance >= 52 ? 'Pusti za osvježavanje podataka s Dunava...' : 'Povuci prema dolje za osvježavanje...'}</span>
          </div>
        </div>
      )}

      {/* Obavijest o automatskom Live Web ažuriranju */}
      {liveUpdateBanner && (
        <div className="bg-gradient-to-r from-emerald-950/90 via-teal-950/90 to-cyan-950/90 border-b border-emerald-500/50 px-3 py-2 text-center text-xs font-bold text-emerald-300 flex items-center justify-center gap-2 animate-fade-in">
          <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{liveUpdateBanner}</span>
        </div>
      )}

      {/* Hero Header sa sažetkom stanja na Dunavu */}
      <div className={`${highContrast ? 'bg-slate-800/90 border-b border-white/60 shadow-[0_2px_14px_rgba(255,255,255,0.1)]' : 'bg-gradient-to-b from-slate-900 to-slate-950 border-b border-slate-800/80'} px-3 sm:px-6 lg:px-8 py-2 sm:py-3.5 w-full max-w-full overflow-hidden`}>
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-2 sm:gap-3.5 w-full">
          
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap text-xs text-cyan-400 font-bold mb-0.5">
              <span className="flex items-center gap-1.5 font-mono text-slate-300">
                <Calendar className="w-3.5 h-3.5 text-cyan-400" /> {solunarData.formattedDate}
              </span>
            </div>

            <h1 className="text-lg sm:text-3xl lg:text-4xl font-black text-white tracking-tight break-words">
              Hidrometeo & Solunarni Centar Dunava
            </h1>

            {/* Odabir načina prikaza: Na većim ekranima uvijek vidljiv, na mobitelu služi donja traka kako ne bi bilo duplih gumba */}
            <div className="hidden md:flex mt-2.5 items-center gap-2 flex-nowrap w-full max-w-full overflow-hidden py-0.5">
              <div className="inline-flex p-1 bg-slate-950/90 rounded-2xl border border-slate-800 shadow-inner shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('basic');
                    localStorage.setItem('ribo_app_view_mode', 'basic');
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap ${
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
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                    viewMode === 'expert'
                      ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-md font-black'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span>🎯 Pro mod</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowLovostajModal(true)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 bg-gradient-to-r from-emerald-950/90 to-teal-950/90 hover:from-emerald-900 hover:to-teal-900 text-emerald-200 border border-emerald-500/40 shadow-md active:scale-95 shrink-0 whitespace-nowrap"
                title="Prikaz pravilnika: Lovostaj i najmanja lovna mjera"
              >
                <span>🐟 Lovostaj</span>
              </button>

              <button
                type="button"
                onClick={() => setShowCatchLogModal(true)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 bg-gradient-to-r from-amber-950/90 to-yellow-950/90 hover:from-amber-900 hover:to-yellow-900 text-amber-200 border border-amber-500/40 shadow-md active:scale-95 shrink-0 whitespace-nowrap"
                title="Zajednička evidencija ulova po vrstama ribe (Sikac, Krasni, Domo, Mališa)"
              >
                <span>🏆 Evidencija ulova</span>
              </button>

              <span className="text-[11px] text-slate-400 hidden lg:inline-block truncate">
                {viewMode === 'basic' ? 'Pojednostavljeni brzi pregled za vodu' : 'Puni ribolovni centar s grafikonima i savjetima'}
              </span>
            </div>
          </div>

          {/* Brzi sažetak kote u headeru (u Ekspertnom modu) */}
          {viewMode === 'expert' && (
            <div className="grid grid-cols-3 gap-2 w-full lg:w-auto shrink-0 animate-fadeIn">
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

              <button
                type="button"
                onClick={() => handleScrollToChapter('sekcija-solunar')}
                className="bg-slate-900/90 hover:bg-slate-850 border border-indigo-500/40 hover:border-indigo-400 active:scale-95 transition-all rounded-2xl p-2 sm:p-3 flex flex-col items-center sm:items-start text-center sm:text-left justify-between shadow-md min-w-0 cursor-pointer group"
                title="Klikni za skok na poglavlje Solunarni rezultati"
              >
                <span className="w-full text-center sm:text-left font-black text-indigo-300 group-hover:text-indigo-200 text-xs sm:text-sm uppercase whitespace-nowrap leading-none">
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
          <BasicOverviewView 
            aljmas={aljmasData} 
            bogojevo={bogojevoData} 
            solunar={solunarData} 
            isLoading={isLoading} 
            highContrast={highContrast}
            onOpenExpertSection={handleOpenExpertSection}
            onOpenLovostaj={() => setShowLovostajModal(true)}
            onOpenCatchLog={() => setShowCatchLogModal(true)}
          />
        ) : (
          <div className="space-y-6 sm:space-y-8 animate-fadeIn">
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

            {(activeTab === 'sve' || activeTab === 'solunar') && (
              <div id="sekcija-solunar" className="scroll-mt-20">
                <SolunarDailyDashboard 
                  solunar={solunarData} 
                  isLoading={isLoading} 
                />
              </div>
            )}

            {(activeTab === 'sve' || activeTab === 'aljmas') && (
              <div id="sekcija-aljmas" className="scroll-mt-20">
                <StationCardAljmas 
                  data={aljmasData} 
                  isLoading={isLoading} 
                />
              </div>
            )}

            {(activeTab === 'sve' || activeTab === 'bogojevo') && (
              <div id="sekcija-bogojevo" className="scroll-mt-20">
                <StationCardBogojevo 
                  data={bogojevoData} 
                  isLoading={isLoading} 
                />
              </div>
            )}

            {(activeTab === 'sve' || activeTab === 'usporedba') && (
              <div id="sekcija-usporedba" className="scroll-mt-20">
                <StationsComparisonCard 
                  aljmas={aljmasData} 
                  bogojevo={bogojevoData} 
                />
              </div>
            )}

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

      {/* Ujednačena donja mobilna navigacija bez dupliranja */}
      <AndroidBottomNav
        viewMode={viewMode}
        activeTab={activeTab}
        onSelectBasicMode={() => {
          setViewMode('basic');
          localStorage.setItem('ribo_app_view_mode', 'basic');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onSelectExpertTab={(tab) => {
          setActiveTab(tab);
          setViewMode('expert');
          localStorage.setItem('ribo_app_view_mode', 'expert');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenLovostaj={() => setShowLovostajModal(true)}
        onOpenChat={handleOpenChat}
        onOpenCatchLog={() => setShowCatchLogModal(true)}
        unreadChatCount={unreadChatCount}
      />

      {/* Podnožje: Donacije i podrška radu autora (bez napadnog bljeskanja) */}
      <div className="max-w-7xl mx-auto px-4 w-full mt-4 mb-2 text-center">
        <div className="inline-flex items-center justify-center gap-1.5 sm:gap-2 py-2 px-3.5 sm:px-5 rounded-2xl bg-slate-900/90 border border-amber-500/30 text-[11px] sm:text-xs text-slate-300 shadow-lg flex-wrap">
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
              <span>v{activeAppVersion} • Live Web Ažuriranje</span>
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
      <ModalErrorBoundary onReset={handleCloseChat} fallbackTitle="LiveChat Smetnja">
        <FishingChatModal
          isOpen={showChatModal}
          onClose={handleCloseChat}
        />
      </ModalErrorBoundary>

      {/* Modal za Lovostaj i najmanje lovne mjere (PDF) */}
      <ModalErrorBoundary onReset={() => setShowLovostajModal(false)} fallbackTitle="Lovostaj Smetnja">
        <LovostajModal
          isOpen={showLovostajModal}
          onClose={() => setShowLovostajModal(false)}
        />
      </ModalErrorBoundary>

      {/* Modal za Evidenciju ulova po vrstama ribe (Sikac, Krasni, Domo, Mališa) */}
      <ModalErrorBoundary onReset={() => setShowCatchLogModal(false)} fallbackTitle="Evidencija Ulova Smetnja">
        <CatchLogModal
          isOpen={showCatchLogModal}
          onClose={() => setShowCatchLogModal(false)}
        />
      </ModalErrorBoundary>

    </div>
  );
}
