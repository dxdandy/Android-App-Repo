/**
 * Servis za interni Dunavski chat među aktiviranim ribičima
 * Autor: Daniel Čizmar
 */

import { getDeviceId, getStoredActivationKey } from './licenseService';

export interface ChatMessage {
  id: string;
  deviceId: string;
  userName: string;
  text: string;
  timestamp: string;
  createdAt: number;
}

/**
 * Dohvaća zadnje poruke iz chata
 */
export async function fetchChatMessages(): Promise<ChatMessage[]> {
  try {
    const res = await fetch('/api/chat/messages', {
      headers: { 'Cache-Control': 'no-cache' }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.messages || [];
  } catch (err) {
    console.error('Greška pri dohvatu chata:', err);
    return [];
  }
}

/**
 * Šalje poruku u chat
 */
export async function sendChatMessage(text: string): Promise<{ success: boolean; message?: ChatMessage; error?: string }> {
  const deviceId = getDeviceId();
  const activationKey = getStoredActivationKey();

  if (!text || !text.trim()) {
    return { success: false, error: 'Poruka ne može biti prazna.' };
  }

  try {
    const res = await fetch('/api/chat/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId,
        activationKey,
        text: text.trim()
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { success: false, error: err.error || 'Slanje poruke nije uspjelo.' };
    }

    const data = await res.json();
    return { success: true, message: data.message };
  } catch (err: any) {
    return { success: false, error: 'Nema veze s poslužiteljem chata.' };
  }
}

/**
 * Admin brisanje poruke
 */
export async function deleteChatMessageAsAdmin(pin: string, messageId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/admin/chat/messages/${encodeURIComponent(messageId)}`, {
      method: 'DELETE',
      headers: { 'x-admin-pin': pin.trim() }
    });
    return res.ok;
  } catch {
    return false;
  }
}
