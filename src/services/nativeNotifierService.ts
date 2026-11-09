import { registerPlugin } from '@capacitor/core';

interface ChatNativeNotifierPlugin {
  setDeviceId(options: { deviceId: string }): Promise<void>;
  setInChat(options: { inChat: boolean }): Promise<void>;
  checkNow(): Promise<void>;
  sendTestNotification(options?: { title?: string; text?: string }): Promise<{ success: boolean }>;
}

export const ChatNativeNotifier = registerPlugin<ChatNativeNotifierPlugin>('ChatNativeNotifier');

/**
 * Sinkronizira ID ovog uređaja s nativnim Android pozadinskim servisom
 * kako bi native Java servis znao tko je vlasnik uređaja i da ne šalje obavijesti za vlastite poruke
 */
export async function syncDeviceIdToNative(deviceId: string): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    if ((window as any).Capacitor?.isNativePlatform?.()) {
      await ChatNativeNotifier.setDeviceId({ deviceId: deviceId.trim() });
    }
  } catch (err) {
    console.debug('ChatNativeNotifier.setDeviceId info:', err);
  }
}

/**
 * Obavještava nativni servis je li korisnik trenutno unutar LiveChat prozora
 * Ako je korisnik u chatu, nativne skočne obavijesti se privremeno stišavaju
 */
export async function setNativeInChatStatus(inChat: boolean): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    if ((window as any).Capacitor?.isNativePlatform?.()) {
      await ChatNativeNotifier.setInChat({ inChat });
    }
  } catch (err) {
    console.debug('ChatNativeNotifier.setInChat info:', err);
  }
}

/**
 * Ručno testiranje nativne obavijesti s ikonom udice i zvukom
 */
export async function testNativeChatNotification(senderName: string = 'Daniel Čizmar', text: string = 'Test obavijesti s ikonom udice na zaključanom zaslonu!'): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    if ((window as any).Capacitor?.isNativePlatform?.()) {
      const res = await ChatNativeNotifier.sendTestNotification({ title: senderName, text });
      return res?.success ?? true;
    }
  } catch (err) {
    console.debug('ChatNativeNotifier.sendTestNotification info:', err);
  }
  return false;
}
