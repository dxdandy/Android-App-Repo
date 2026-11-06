import { LocalNotifications } from '@capacitor/local-notifications';

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
 * Svira čist i ugodan dvotonski ribički chime (akord G5 -> C6) za novu poruku
 */
export function playNotificationSound(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Prvi ton: 784 Hz (G5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(784, now);
    gain1.gain.setValueAtTime(0.18, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);

    // Drugi ton: 1046.5 Hz (C6) - zvonki signal
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1046.5, now + 0.12);
    gain2.gain.setValueAtTime(0, now);
    gain2.gain.setValueAtTime(0.22, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.5);
  } catch (err) {
    console.warn('Greška pri reprodukciji zvučne obavijesti:', err);
  }
}

/**
 * Traži dozvolu za prikaz sistemskih i zvučnih obavijesti (Android + PWA/Web)
 */
export async function requestNotificationPermission(): Promise<boolean> {
  let granted = false;

  // 1. Android Capacitor Native Permissions
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

  // Uvijek pokušaj zasvirati ton
  playNotificationSound();

  // 1. Android nativna obavijest putem Capacitor LocalNotifications (radi i u pozadini s tonom)
  try {
    const notifId = Math.floor(Math.random() * 100000) + 1;
    await LocalNotifications.schedule({
      notifications: [
        {
          id: notifId,
          title,
          body,
          smallIcon: 'ic_stat_fish',
          iconColor: '#0891b2',
          sound: 'beep.wav',
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
 * Prikazuje crveni krug s brojem nepročitanih poruka kao na WhatsAppu/Gmailu
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
    }
  } catch {}
}
