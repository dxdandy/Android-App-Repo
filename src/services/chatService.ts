import { getDeviceId, getStoredActivationKey, setStoredUserName, getApiUrl, safeFetchJson } from './licenseService';

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
const LAST_READ_CHAT_TIME_KEY = 'ribo_last_read_chat_time';

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
 * Ažurira oznaku s brojem nepročitanih poruka (App Badge) na ikoni aplikacije na zaslonu uređaja
 * (poput WhatsAppa i Gmaila na Androidu / PWA) te na naslovu aplikacije
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

/**
 * Izračunava broj nepročitanih poruka za trenutnog korisnika
 */
export function getUnreadChatCount(messages: ChatMessage[], currentDeviceId: string): number {
  if (typeof window === 'undefined' || !Array.isArray(messages)) return 0;
  try {
    const raw = localStorage.getItem(LAST_READ_CHAT_TIME_KEY);
    const lastReadTime = raw ? parseInt(raw, 10) : 0;
    
    // Poruke koje su stigle poslije zadnjeg pregleda chata i koje nije poslao ovaj korisnik
    const unread = messages.filter(m => m.deviceId !== currentDeviceId && (m.createdAt || 0) > lastReadTime);
    return unread.length;
  } catch {
    return 0;
  }
}

/**
 * Označava sve trenutne poruke pročitanima i uklanja obavijest s ikone
 */
export function markChatAsRead(messages?: ChatMessage[]): void {
  if (typeof window === 'undefined') return;
  try {
    let latestTime = Date.now();
    if (messages && messages.length > 0) {
      const maxMsgTime = Math.max(...messages.map(m => m.createdAt || 0));
      if (maxMsgTime > 0) latestTime = Math.max(latestTime, maxMsgTime);
    }
    localStorage.setItem(LAST_READ_CHAT_TIME_KEY, String(latestTime));
    updateAppBadge(0);
  } catch {}
}

/**
 * Mijenja vlastito ime korisnika u chatu i sinkronizira ga s poslužiteljem i bazom
 */
export async function renameMyUserName(newName: string): Promise<{ success: boolean; userName: string; error?: string }> {
  const clean = newName.trim();
  if (!clean) return { success: false, userName: '', error: 'Ime ne može biti prazno.' };

  const deviceId = getDeviceId();
  // 1. Spremi lokalno odmah
  setStoredUserName(clean);

  // 2. Pošalji na poslužitelj
  const res = await safeFetchJson<{ success: boolean; userName: string; error?: string }>(
    getApiUrl('/api/chat/rename'),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, newName: clean })
    }
  );

  if (res.ok && res.data?.userName) {
    setStoredUserName(res.data.userName);
    return { success: true, userName: res.data.userName };
  }

  return { success: true, userName: clean };
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
