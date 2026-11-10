import { LocalNotifications } from '@capacitor/local-notifications';
import { clearNativeNotifications, syncLastSeenMessageToNative } from './nativeNotifierService';

/**
 * Provjerava radi li aplikacija na Android / mobilnom uređaju
 * Na Androidu Web Audio API (AudioContext) uvijek ide preko STREAM_MUSIC (glasnoća medija)
 * umjesto STREAM_NOTIFICATION (sistemska glasnoća obavijesti), pa se na mobitelu
 * isključivo koristi nativni Android sustav obavijesti koji 100% poštuje klizač glasnoće obavijesti korisnika!
 */
function isAndroidOrNativeMobile(): boolean {
  if (typeof window === 'undefined') return false;
  const isCapNative = Boolean((window as any).Capacitor?.isNativePlatform?.());
  const isAndroidUA = /Android/i.test(navigator.userAgent || '');
  return isCapNative || isAndroidUA;
}

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined' || isAndroidOrNativeMobile()) return null;
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
 * Svira vrlo tihi diskretni ton isključivo na desktop web pregledniku.
 * Na Android mobitelima se NE koristi Web Audio jer Android WebView usmjerava Web Audio na
 * glasnoću medija (STREAM_MUSIC) umjesto na sistemsku glasnoću obavijesti (STREAM_NOTIFICATION).
 */
export function playNotificationSound(): void {
  if (isAndroidOrNativeMobile()) {
    // Na Androidu zvuk reproducira isključivo sustav obavijesti prema sistemskoj glasnoći korisnika
    return;
  }

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(784, now);
    gain1.gain.setValueAtTime(0.01, now);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.23);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1046.5, now + 0.09);
    gain2.gain.setValueAtTime(0, now);
    gain2.gain.setValueAtTime(0.012, now + 0.09);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.09);
    osc2.stop(now + 0.34);
  } catch (err) {
    console.warn('Greška pri reprodukciji zvučne obavijesti:', err);
  }
}

export const SYSTEM_NOTIFICATION_CHANNEL_ID = 'ribo_chat_system_default_v6';

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

    // Kreiraj kanal sa standardnom sistemskom razinom glasnoće (importance: 3 = IMPORTANCE_DEFAULT)
    // kako bi glasnoća obavijesti bila 100% identična ostalim aplikacijama na mobitelu (WhatsApp, Viber, SMS)
    await LocalNotifications.createChannel({
      id: SYSTEM_NOTIFICATION_CHANNEL_ID,
      name: 'LiveChat Poruke (Sistemska glasnoća)',
      description: 'Obavijesti o novim porukama usklađene s vašim sistemskim postavkama glasnoće obavijesti',
      importance: 3, // IMPORTANCE_DEFAULT - poštuje tihi režim i sistemski klizač obavijesti
      visibility: 1, // VISIBILITY_PUBLIC
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

  return granted;
}

/**
 * Prikazuje sistemsku obavijest kada stigne nova poruka,
 * koristeći isključivo sistemsku glasnoću obavijesti uređaja (STREAM_NOTIFICATION).
 */
export async function showIncomingMessageNotification(
  senderName: string,
  messageText: string,
  messageId?: string
): Promise<void> {
  const title = `🎣 LiveChat: ${senderName}`;
  const body = messageText.length > 70 ? messageText.slice(0, 67) + '...' : messageText;

  // Odmah zabilježi ID poruke u nativni RiboChatPrefs kako pozadinski servis ne bi poslao duplu (glasnu) obavijest
  if (messageId) {
    try {
      await syncLastSeenMessageToNative(messageId, Date.now());
    } catch {}
  }

  // Na desktop pregledniku odsviraj tihi ton
  if (!isAndroidOrNativeMobile()) {
    playNotificationSound();
  }

  // 1. Android Capacitor LocalNotifications preko kanala sa sistemskom glasnoćom (importance: 3)
  try {
    await LocalNotifications.createChannel({
      id: SYSTEM_NOTIFICATION_CHANNEL_ID,
      name: 'LiveChat Poruke (Sistemska glasnoća)',
      description: 'Obavijesti o novim porukama usklađene s vašim sistemskim postavkama glasnoće obavijesti',
      importance: 3,
      visibility: 1,
      vibration: true,
      lights: true,
      lightColor: '#0891b2'
    }).catch(() => {});

    const notifId = Math.floor(Math.random() * 100000) + 1;
    await LocalNotifications.schedule({
      notifications: [
        {
          id: notifId,
          title,
          body,
          channelId: SYSTEM_NOTIFICATION_CHANNEL_ID,
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
    return;
  } catch {
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
            tag: messageId || 'ribo-chat-msg'
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
 * Prikazuje obavijest s ikonom udice kada je dostupno novo Live Web ažuriranje
 */
export async function showAppUpdateAvailableNotification(
  version: string,
  summaryText?: string
): Promise<void> {
  const title = `🎣 RiboPrognoza - Novo Live ažuriranje (v${version})`;
  const body = summaryText || 'Dostupna su nova poboljšanja! Dodirnite za primjenu.';

  if (!isAndroidOrNativeMobile()) {
    playNotificationSound();
  }

  try {
    const notifId = 888800 + (parseInt(version.replace(/\D/g, ''), 10) % 999);
    await LocalNotifications.schedule({
      notifications: [
        {
          id: notifId,
          title,
          body,
          channelId: SYSTEM_NOTIFICATION_CHANNEL_ID,
          smallIcon: 'ic_stat_hook',
          iconColor: '#0891b2',
          actionTypeId: '',
          extra: {
            updateVersion: version,
            type: 'app_live_update'
          }
        }
      ]
    });
  } catch {}

  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration && registration.showNotification) {
          registration.showNotification(title, {
            body,
            icon: '/pwa-192x192.png',
            badge: '/pwa-192x192.png',
            tag: `ribo-update-v${version}`
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
