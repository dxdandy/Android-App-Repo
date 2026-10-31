/**
 * Servis za interni Dunavski chat među aktiviranim ribičima
 * Autor: Daniel Čizmar
 */

import { getDeviceId, getStoredActivationKey, getApiUrl, safeFetchJson } from './licenseService';

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

const LOCAL_CHAT_CACHE_KEY = 'ribo_chat_messages_cache';

function getLocalChatCache(): ChatMessage[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_CHAT_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalChatCache(msgs: ChatMessage[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_CHAT_CACHE_KEY, JSON.stringify(msgs.slice(-60)));
  } catch {}
}

/**
 * Dohvaća zadnje poruke iz chata (samo ako je korisnik odobren)
 */
export async function fetchChatMessages(overrideDeviceId?: string): Promise<FetchChatResult> {
  const deviceId = overrideDeviceId || getDeviceId();
  const res = await safeFetchJson<{ success: boolean; messages: ChatMessage[]; chatBlocked?: boolean; message?: string }>(
    getApiUrl(`/api/chat/messages?deviceId=${encodeURIComponent(deviceId)}`),
    {
      headers: { 
        'Cache-Control': 'no-cache',
        'x-device-id': deviceId
      }
    }
  );

  if (res.data?.chatBlocked || (!res.ok && res.status === 403)) {
    return {
      messages: [],
      chatBlocked: true,
      message: res.data?.message || res.error || 'Pristup LiveChatu je onemogućen od strane administratora.'
    };
  }

  if (res.ok && res.data?.messages) {
    saveLocalChatCache(res.data.messages);
    return {
      messages: res.data.messages,
      chatBlocked: false
    };
  }

  // Ako poslužitelj nije dostupan, prikaži zadnje predmemorirane poruke
  const cached = getLocalChatCache();
  return {
    messages: cached,
    chatBlocked: false
  };
}

/**
 * Admin dohvat svih poruka chata
 */
export async function fetchChatMessagesForAdmin(pin: string): Promise<ChatMessage[]> {
  const res = await safeFetchJson<{ success: boolean; messages: ChatMessage[] }>(
    getApiUrl('/api/chat/messages'),
    {
      headers: { 
        'Cache-Control': 'no-cache',
        'x-admin-pin': pin.trim()
      }
    }
  );

  if (res.ok && res.data?.messages) {
    return res.data.messages;
  }

  return getLocalChatCache();
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

  const res = await safeFetchJson<{ success: boolean; message: ChatMessage; error?: string }>(
    getApiUrl('/api/chat/messages'),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId,
        activationKey,
        text: text.trim()
      })
    }
  );

  if (res.ok && res.data?.message) {
    const current = getLocalChatCache();
    current.push(res.data.message);
    saveLocalChatCache(current);
    return { success: true, message: res.data.message };
  }

  return { 
    success: false, 
    error: res.error || 'Slanje poruke nije uspjelo.' 
  };
}

/**
 * Admin brisanje poruke
 */
export async function deleteChatMessageAsAdmin(pin: string, messageId: string): Promise<boolean> {
  const res = await safeFetchJson(
    getApiUrl(`/api/admin/chat/messages/${encodeURIComponent(messageId)}`),
    {
      method: 'DELETE',
      headers: { 'x-admin-pin': pin.trim() }
    }
  );
  return res.ok;
}
