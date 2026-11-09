import { LocalNotifications } from '@capacitor/local-notifications';
import { ChatNativeNotifier, clearNativeNotifications } from './nativeNotifierService';

/**
 * Zvučni sintetizator za obavijesti o novim porukama (Web Audio API)
 * Radi 100% pouzdano bez vanjskih datoteka na svim mobilnim i desktop uređajima
 */
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      if (!audioCtx || audioCtx.state === 'closed') {
        audioCtx = new AudioContextClass();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
      return audioCtx;
    }
  } catch (err) {
    console.warn('AudioContext nije podržan:', err);
  }
  return null;
}

/**
 * Svira nježan, ugodan i diskretan ribički chime (G5 -> C6)
 * Usklađen sa sistemskim nivoom glasnoće kako ne bi bio preglasan
 */
export function playNotificationSound(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Prvi diskretan ton: 784 Hz (G5) s blagim gainom 0.04
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(784, now);
    gain1.gain.setValueAtTime(0.04, now);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.26);

    // Drugi ton: 1046.5 Hz (C6) s blagim gainom 0.05
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1046.5, now + 0.1);
    gain2.gain.setValueAtTime(0, now);
    gain2.gain.setValueAtTime(0.05, now + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.1);
    osc2.stop(now + 0.42);
  } catch (err) {
    console.warn('Greška pri reprodukciji zvučne obavijesti:', err);
  }
}

/**
 * Traži dozvolu za prikaz sistemskih i zvučnih obavijesti (Android + PWA/Web)
 */
export async function requestNotificationPermission(): Promise<boolean> {
  let granted = false;

  // 1. Android Capacitor Native Permissions & Channel setup
  try {
    const permStatus = await LocalNotifications.checkPermissions();
    if (permStatus.display === 'granted') {
      granted = true;
    } else {
      const reqStatus = await LocalNotifications.requestPermissions();
      if (reqStatus.display === 'granted') {
        granted = true;
      }
    }

    // Kreiraj kanal visoke važnosti (heads-up, status bar, zaključani zaslon i Always On Display)
    await LocalNotifications.createChannel({
      id: 'ribo_chat_sms_channel_v5',
      name: 'RiboPrognoza LiveChat Poruke',
      description: 'Zvučne, skočne i Lockscreen obavijesti s ikonom udice za nove poruke',
      importance: 5, // IMPORTANCE_HIGH
      visibility: 1, // VISIBILITY_PUBLIC (prikaz na Lock screenu i AOD)
      vibration: true,
      lights: true,
      lightColor: '#0891b2'
    });
  } catch {
    // Nije Capacitor okruženje ili nije podržano
  }

  // 2. Web / PWA Notification API
  if (typeof window !== 'undefined' && 'Notification' in window) {
    try {
      if (Notification.permission === 'granted') {
        granted = true;
      } else if (Notification.permission !== 'denied') {
        const result = await Notification.requestPermission();
        if (result === 'granted') {
          granted = true;
        }
      }
    } catch {}
  }

  // Inicijaliziraj audio kontekst na korisnički dodir
  getAudioContext();

  return granted;
}

/**
 * Prikazuje sistemsku obavijest s tonom i vibracijom kada stigne nova poruka,
 * čak i kada korisnik nije u aplikaciji (u pozadini ili na drugom zaslonu)
 */
export async function showIncomingMessageNotification(
  senderName: string,
  messageText: string,
  messageId?: string
): Promise<void> {
  const title = `🎣 LiveChat: ${senderName}`;
  const body = messageText.length > 70 ? messageText.slice(0, 67) + '...' : messageText;

  // Zvuk se reproducira preko Web Audio samo ako nismo na nativnoj platformi
  // (Na Android nativnoj platformi Android sustav već sam reproducira ton obavijesti preko STREAM_NOTIFICATION)
  const isNative = typeof window !== 'undefined' && Boolean((window as any).Capacitor?.isNativePlatform?.());
  if (!isNative) {
    playNotificationSound();
  }

  // 1. Android nativna obavijest s ikonom udice i zvukom (prioritet: nativni Java notifier)
  if (isNative) {
    try {
      await ChatNativeNotifier.sendTestNotification({
        title: senderName,
        text: messageText
      });
      return;
    } catch {
      // Nastavi na LocalNotifications fallback
    }
  }

  // 1b. Capacitor LocalNotifications fallback
  try {
    const notifId = Math.floor(Math.random() * 100000) + 1;
    await LocalNotifications.schedule({
      notifications: [
        {
          id: notifId,
          title,
          body,
          channelId: 'ribo_chat_sms_channel_v5',
          smallIcon: 'ic_stat_hook',
          iconColor: '#0891b2',
          actionTypeId: '',
          extra: {
            messageId,
            senderName
          }
        }
      ]
    });
  } catch (err) {
    // Ako nije nativni Capacitor, prelazimo na Web Notification
  }

  // 2. Web / PWA sistemska obavijest ako je podržano i odobreno
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration && registration.showNotification) {
          registration.showNotification(title, {
            body,
            icon: '/pwa-192x192.png',
            badge: '/pwa-192x192.png',
            tag: messageId || 'ribo-chat-msg',
            vibrate: [200, 100, 200]
          } as any);
          return;
        }
      }

      new Notification(title, {
        body,
        icon: '/pwa-192x192.png',
        tag: messageId || 'ribo-chat-msg'
      } as any);
    } catch {}
  }
}

/**
 * Ažurira oznaku na instalacijskoj ikoni aplikacije na početnom zaslonu (App Badging API)
 * Kada korisnik pročita sve poruke (count <= 0), poništava obavijesti u traci i bedž ikone
 */
export function updateAppBadge(count: number): void {
  if (typeof window === 'undefined') return;
  try {
    if (count > 0) {
      if ('setAppBadge' in navigator) {
        (navigator as any).setAppBadge(count).catch(() => {});
      }
      if (typeof document !== 'undefined') {
        document.title = `(${count}) RiboPrognoza`;
      }
    } else {
      if ('clearAppBadge' in navigator) {
        (navigator as any).clearAppBadge().catch(() => {});
      }
      if (typeof document !== 'undefined') {
        document.title = 'RiboPrognoza';
      }
      // Poništi obavijesti na Android uređaju čime se automatski briše i sistemski bedž ikone na mobitelu
      try {
        LocalNotifications.removeAllDeliveredNotifications().catch(() => {});
      } catch {}
      try {
        clearNativeNotifications().catch(() => {});
      } catch {}
    }
  } catch {}
}

/**
 * Prikazuje obavijest s ikonom udice u traci i na zaključanom zaslonu
 * kada je dostupno novo Live Web ažuriranje za aplikaciju
 */
export async function showAppUpdateAvailableNotification(
  version: string,
  summaryText?: string
): Promise<void> {
  const title = `🎣 RiboPrognoza - Novo Live ažuriranje (v${version})`;
  const body = summaryText || 'Dostupna su nova ribička poboljšanja! Dodirnite za trenutačnu primjenu bez preuzimanja APK-a.';

  playNotificationSound();

  // 1. Android nativna obavijest s ikonom udice
  try {
    const notifId = 888800 + (parseInt(version.replace(/\D/g, ''), 10) % 999);
    await LocalNotifications.schedule({
      notifications: [
        {
          id: notifId,
          title,
          body,
          channelId: 'ribo_chat_sms_channel_v4',
          smallIcon: 'ic_stat_hook',
          iconColor: '#0891b2',
          sound: 'beep.wav',
          actionTypeId: '',
          extra: {
            updateVersion: version,
            type: 'app_live_update'
          }
        }
      ]
    });
  } catch {
    // Nije nativni Capacitor
  }

  // 2. Web / PWA Notification
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration && registration.showNotification) {
          registration.showNotification(title, {
            body,
            icon: '/pwa-192x192.png',
            badge: '/pwa-192x192.png',
            tag: `ribo-update-v${version}`,
            vibrate: [150, 100, 150]
          } as any);
          return;
        }
      }

      new Notification(title, {
        body,
        icon: '/pwa-192x192.png',
        tag: `ribo-update-v${version}`
      } as any);
    } catch {}
  }
}

