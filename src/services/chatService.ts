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

export interface FetchChatResult {
  messages: ChatMessage[];
  chatBlocked?: boolean;
  message?: string;
}

/**
 * Dohvaća zadnje poruke iz chata (samo ako je korisnik odobren)
 */
export async function fetchChatMessages(overrideDeviceId?: string): Promise<FetchChatResult> {
  try {
    const deviceId = overrideDeviceId || getDeviceId();
    const res = await fetch(`/api/chat/messages?deviceId=${encodeURIComponent(deviceId)}`, {
      headers: { 
        'Cache-Control': 'no-cache',
        'x-device-id': deviceId
      }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.chatBlocked) {
      return {
        messages: [],
        chatBlocked: true,
        message: data.message || 'Pristup LiveChatu je onemogućen.'
      };
    }
    return {
      messages: data.messages || [],
      chatBlocked: false
    };
  } catch (err) {
    console.error('Greška pri dohvatu chata:', err);
    return { messages: [], chatBlocked: false };
  }
}

/**
 * Admin dohvat svih poruka chata
 */
export async function fetchChatMessagesForAdmin(pin: string): Promise<ChatMessage[]> {
  try {
    const res = await fetch('/api/chat/messages', {
      headers: { 
        'Cache-Control': 'no-cache',
        'x-admin-pin': pin.trim()
      }
    });
    const data = await res.json().catch(() => ({}));
    return data.messages || [];
  } catch (err) {
    console.error('Greška pri dohvatu chata za admina:', err);
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
