import { 
  getDeviceId, 
  getStoredActivationKey, 
  setStoredUserName, 
  getUserName, 
  getApiUrl, 
  safeFetchJson,
  getLocalLicenses,
  renameUserAsAdmin,
  isAdminUnlocked,
  setAdminUnlocked
} from './licenseService';
import { updateAppBadge } from './notificationService';
import { syncLastSeenMessageToNative } from './nativeNotifierService';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  deleteDoc, 
  query, 
  orderBy, 
  limitToLast, 
  onSnapshot, 
  Unsubscribe 
} from 'firebase/firestore';
import { db } from './firebase';

export { updateAppBadge, renameUserAsAdmin, isAdminUnlocked, setAdminUnlocked };

export interface ChatReadReceipt {
  deviceId: string;
  userName: string;
  readAt: number;
}

export interface ChatReplyTo {
  id: string;
  userName: string;
  text: string;
}

export interface ChatReaction {
  emoji: string;
  deviceId: string;
  userName: string;
  createdAt?: number;
}

export interface ChatMessage {
  id: string;
  deviceId: string;
  userName: string;
  text: string;
  timestamp: string;
  createdAt: number;
  readBy?: ChatReadReceipt[];
  replyTo?: ChatReplyTo;
  reactions?: ChatReaction[];
}

export interface FetchChatResult {
  messages: ChatMessage[];
  chatBlocked?: boolean;
  message?: string;
}

export interface TypingUser {
  deviceId: string;
  userName: string;
}

const LOCAL_CHAT_CACHE_KEY = 'ribo_chat_messages_cache';
const LAST_READ_CHAT_TIME_KEY = 'ribo_last_read_chat_time';

// Izravni Firestore REST URL za pričuvnu sinkronizaciju otpornu na kvotu čitanja (PATCH mehanizam)
const FIRESTORE_REST_BASE =
  'https://firestore.googleapis.com/v1/projects/titanium-domain-wv4kj/databases/ai-studio-hrvatskiradnipro-badf4099-cdd8-4a4a-b90c-6a3aea6c7b94/documents';

// Evidencija već poslanih potvrda čitanja u ovoj sesiji kako se nikada ne bi slali dupli upiti
const sentReadReceiptsSet = new Set<string>();

// Dijeljena mapa poruka i imena za sve komponente u aplikaciji (Singleton)
const sharedMessageMap = new Map<string, ChatMessage>();
const sharedUserNamesMap = new Map<string, string>();
const activeSubscribers = new Set<(result: FetchChatResult) => void>();

let sharedUnsubscribeLicenses: Unsubscribe | null = null;
let sharedUnsubscribeMessages: Unsubscribe | null = null;
let sharedPollTimer: any = null;
let sharedRoomPatchTimer: any = null;
let sharedIsChatBlocked = false;
let sharedBlockedReason = '';

function sanitizeFieldKey(msgId: string): string {
  return 'm_' + msgId.replace(/[^a-zA-Z0-9_]/g, '_');
}

export function getLocalChatCache(): ChatMessage[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_CHAT_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalChatCache(msgs: ChatMessage[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_CHAT_CACHE_KEY, JSON.stringify(msgs.slice(-80)));
  } catch {}
}

/**
 * Pretvara podatke iz Firestore dokumenta u standardni ChatMessage objekt
 */
function normalizeChatMessage(id: string, data: any): ChatMessage {
  const senderDeviceId = data.deviceId || '';
  const officialSenderName = sharedUserNamesMap.get(senderDeviceId) || data.userName || 'Ribič';

  const rawReadBy: ChatReadReceipt[] = Array.isArray(data.readBy) ? data.readBy : [];
  const enrichedReadBy = rawReadBy.map(r => ({
    deviceId: r.deviceId || '',
    userName: sharedUserNamesMap.get(r.deviceId) || r.userName || 'Ribič',
    readAt: r.readAt || 0
  }));

  const rawReactions: ChatReaction[] = Array.isArray(data.reactions) ? data.reactions : [];
  const enrichedReactions = rawReactions
    .filter(rx => rx && rx.emoji && rx.deviceId)
    .map(rx => ({
      emoji: rx.emoji,
      deviceId: rx.deviceId,
      userName: sharedUserNamesMap.get(rx.deviceId) || rx.userName || 'Ribič',
      createdAt: rx.createdAt || 0
    }));

  return {
    id: id || data.id || '',
    deviceId: senderDeviceId,
    userName: officialSenderName,
    text: data.text || '',
    timestamp: data.timestamp || '',
    createdAt: Number(data.createdAt) || 0,
    readBy: enrichedReadBy,
    replyTo: data.replyTo || undefined,
    reactions: enrichedReactions
  };
}

/**
 * Emitira trenutno spojene i sortirane poruke svim aktivnim pretplatnicima u aplikaciji
 */
function emitToAllSubscribers(): void {
  if (sharedIsChatBlocked) {
    const blockedRes: FetchChatResult = {
      messages: [],
      chatBlocked: true,
      message: sharedBlockedReason || 'Pristup LiveChatu je onemogućen.'
    };
    activeSubscribers.forEach(cb => {
      try { cb(blockedRes); } catch {}
    });
    return;
  }

  const sorted = Array.from(sharedMessageMap.values())
    .filter(m => m && m.id && m.id !== '_room_state_' && m.text)
    .map(msg => normalizeChatMessage(msg.id, msg))
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

  saveLocalChatCache(sorted);

  const okRes: FetchChatResult = {
    messages: sorted,
    chatBlocked: false
  };

  activeSubscribers.forEach(cb => {
    try { cb(okRes); } catch {}
  });
}

/**
 * Sinkronizira poruku ili stanje chata preko jedinstvenog dokumenta app_updates/chat_room_state
 * koristeći Firestore REST PATCH (radi 100% čak i ako je dnevna kvota čitanja iscrpljena!)
 */
async function syncRoomStateViaRestPatch(changedMsg?: ChatMessage, deletedMsgId?: string): Promise<boolean> {
  try {
    const queryParams: string[] = ['updateMask.fieldPaths=_ping'];
    const fieldsPayload: Record<string, any> = {
      _ping: { integerValue: String(Date.now()) }
    };

    if (changedMsg && changedMsg.id) {
      const fKey = sanitizeFieldKey(changedMsg.id);
      queryParams.push(`updateMask.fieldPaths=${encodeURIComponent(fKey)}`);
      fieldsPayload[fKey] = { stringValue: JSON.stringify(changedMsg) };
    }

    if (deletedMsgId) {
      const delKey = sanitizeFieldKey(deletedMsgId);
      queryParams.push(`updateMask.fieldPaths=${encodeURIComponent(delKey)}`);
      // Izostavljanjem polja iz fieldsPayload uz prisutnost u updateMask briše se polje
    }

    const url = `${FIRESTORE_REST_BASE}/app_updates/chat_room_state?${queryParams.join('&')}`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: fieldsPayload })
    });

    if (!res.ok) return false;
    const docData = await res.json();
    const docFields = docData?.fields || {};

    let hasChanges = false;
    const roomEntries: { key: string; msg: ChatMessage }[] = [];

    for (const [k, valObj] of Object.entries(docFields)) {
      if (!k.startsWith('m_')) continue;
      const rawStr = (valObj as any)?.stringValue;
      if (!rawStr) continue;
      try {
        const parsed = JSON.parse(rawStr) as ChatMessage;
        if (parsed && parsed.id && parsed.text) {
          roomEntries.push({ key: k, msg: parsed });
          const existing = sharedMessageMap.get(parsed.id);
          const norm = normalizeChatMessage(parsed.id, parsed);
          if (
            !existing ||
            existing.text !== norm.text ||
            (existing.readBy?.length || 0) !== (norm.readBy?.length || 0) ||
            JSON.stringify(existing.reactions || []) !== JSON.stringify(norm.reactions || [])
          ) {
            sharedMessageMap.set(norm.id, norm);
            hasChanges = true;
          }
        }
      } catch {}
    }

    // Ako je chat_room_state prazan, a mi imamo lokalne poruke, inicijalno napuni zadnjih 30 poruka
    if (roomEntries.length === 0 && sharedMessageMap.size > 0 && !changedMsg && !deletedMsgId) {
      const recent = Array.from(sharedMessageMap.values())
        .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
        .slice(-30);
      if (recent.length > 0) {
        const seedMasks = recent.map(m => `updateMask.fieldPaths=${encodeURIComponent(sanitizeFieldKey(m.id))}`);
        const seedFields: Record<string, any> = {};
        recent.forEach(m => {
          seedFields[sanitizeFieldKey(m.id)] = { stringValue: JSON.stringify(m) };
        });
        fetch(`${FIRESTORE_REST_BASE}/app_updates/chat_room_state?${seedMasks.join('&')}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields: seedFields })
        }).catch(() => {});
      }
    }

    // Ako se u chat_room_state nakupilo više od 50 poruka, očisti najstarije
    if (roomEntries.length > 50 && changedMsg) {
      roomEntries.sort((a, b) => (a.msg.createdAt || 0) - (b.msg.createdAt || 0));
      const toPrune = roomEntries.slice(0, roomEntries.length - 45);
      if (toPrune.length > 0) {
        const pruneMasks = toPrune.map(e => `updateMask.fieldPaths=${encodeURIComponent(e.key)}`);
        fetch(`${FIRESTORE_REST_BASE}/app_updates/chat_room_state?${pruneMasks.join('&')}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields: {} })
        }).catch(() => {});
      }
    }

    if (hasChanges) {
      emitToAllSubscribers();
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Izračunava broj nepročitanih poruka za trenutnog korisnika
 */
export function getUnreadChatCount(messages: ChatMessage[], currentDeviceId: string): number {
  if (typeof window === 'undefined' || !Array.isArray(messages)) return 0;
  try {
    const raw = localStorage.getItem(LAST_READ_CHAT_TIME_KEY);
    const lastReadTime = raw ? parseInt(raw, 10) : 0;
    
    const unread = messages.filter(m => m.deviceId !== currentDeviceId && (m.createdAt || 0) > lastReadTime);
    return unread.length;
  } catch {
    return 0;
  }
}

/**
 * Označava sve trenutne poruke pročitanima, šalje potvrdu čitanja samo za stvarno nepročitane poruke (BEZ dodatnih getDoc čitanja!)
 */
export function markChatAsRead(messages?: ChatMessage[]): void {
  if (typeof window === 'undefined') return;
  try {
    const myId = getDeviceId();
    let latestTime = Date.now();

    if (messages && messages.length > 0) {
      const maxMsgTime = Math.max(...messages.map(m => m.createdAt || 0));
      if (maxMsgTime > 0) latestTime = Math.max(latestTime, maxMsgTime);

      // Pronađi isključivo poruke drugih korisnika u kojima ovaj uređaj JOŠ NIJE upisan u readBy
      const unreadFromOthers = messages.filter(m => {
        if (!m || !m.id || m.deviceId === myId) return false;
        if (sentReadReceiptsSet.has(m.id)) return false;
        const alreadyInReadBy = (m.readBy || []).some(r => r.deviceId === myId);
        if (alreadyInReadBy) {
          sentReadReceiptsSet.add(m.id);
          return false;
        }
        return true;
      });

      if (unreadFromOthers.length > 0) {
        unreadFromOthers.forEach(m => sentReadReceiptsSet.add(m.id));
        sendReadReceipts(unreadFromOthers.map(m => m.id)).catch(() => {});
      }
    }

    localStorage.setItem(LAST_READ_CHAT_TIME_KEY, String(latestTime));
    updateAppBadge(0);
  } catch {}
}

/**
 * Šalje potvrdu čitanja za poruke bez nepotrebnog trošenja getDoc kvote čitanja
 */
export async function sendReadReceipts(messageIds?: string[]): Promise<void> {
  const deviceId = getDeviceId();
  const userName = getUserName() || `Ribič (${deviceId.slice(-4)})`;
  if (!messageIds || messageIds.length === 0) return;

  // Ažuriraj samo zadnje 3 nepročitane poruke koristeći već postojeće stanje u memoriji (0 getDoc čitanja!)
  const recentIds = messageIds.slice(-3);
  try {
    for (const msgId of recentIds) {
      const existingMsg = sharedMessageMap.get(msgId);
      const existingReceipts: ChatReadReceipt[] = existingMsg?.readBy || [];
      if (!existingReceipts.some(r => r.deviceId === deviceId)) {
        const updatedReceipts = [...existingReceipts, { deviceId, userName, readAt: Date.now() }];
        if (existingMsg) {
          const updatedMsg: ChatMessage = { ...existingMsg, readBy: updatedReceipts };
          sharedMessageMap.set(msgId, updatedMsg);
          syncRoomStateViaRestPatch(updatedMsg).catch(() => {});
        }
        await setDoc(doc(db, 'chat_messages', msgId), { readBy: updatedReceipts }, { merge: true }).catch(() => {});
      }
    }
  } catch {}

  // Pošalji i poslužitelju
  try {
    await safeFetchJson(
      getApiUrl('/api/chat/read'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, userName, messageIds: recentIds })
      }
    );
  } catch {}
}

/**
 * Dodaje ili uklanja reakciju (lajk / emoji) na odabranu poruku u LiveChatu
 */
export async function toggleMessageReaction(
  messageId: string,
  emoji: string
): Promise<{ success: boolean; reactions?: ChatReaction[] }> {
  if (!messageId || !emoji) return { success: false };

  const deviceId = getDeviceId();
  const userName = sharedUserNamesMap.get(deviceId) || getUserName() || `Ribič (${deviceId.slice(-4)})`;

  // Pronađi poruku u memoriji ili lokalnom cacheu
  let targetMsg = sharedMessageMap.get(messageId);
  if (!targetMsg) {
    const cached = getLocalChatCache();
    targetMsg = cached.find(m => m.id === messageId);
  }
  if (!targetMsg) return { success: false };

  const currentReactions: ChatReaction[] = Array.isArray(targetMsg.reactions) ? [...targetMsg.reactions] : [];
  const existingIdx = currentReactions.findIndex(r => r.deviceId === deviceId);

  let updatedReactions: ChatReaction[];
  if (existingIdx >= 0 && currentReactions[existingIdx].emoji === emoji) {
    // Ako je korisnik kliknuo isti emoji koji je već postavio -> ukloni lajk
    updatedReactions = currentReactions.filter((_, idx) => idx !== existingIdx);
  } else if (existingIdx >= 0) {
    // Ako je korisnik odabrao drugi emoji -> zamijeni njegovu reakciju novim emojijem
    updatedReactions = [...currentReactions];
    updatedReactions[existingIdx] = {
      emoji,
      deviceId,
      userName,
      createdAt: Date.now()
    };
  } else {
    // Dodaj novu reakciju
    updatedReactions = [
      ...currentReactions,
      {
        emoji,
        deviceId,
        userName,
        createdAt: Date.now()
      }
    ];
  }

  const updatedMsg: ChatMessage = {
    ...targetMsg,
    reactions: updatedReactions
  };

  // 1. Odmah ažuriraj lokalno stanje i prikaži svim komponentama bez čekanja (0ms odziv)
  sharedMessageMap.set(messageId, updatedMsg);
  emitToAllSubscribers();

  // 2. Spremi u Firestore kolekciju chat_messages
  setDoc(doc(db, 'chat_messages', messageId), { reactions: updatedReactions }, { merge: true }).catch(() => {});

  // 3. Sinkroniziraj u chat_room_state putem REST PATCH metode
  syncRoomStateViaRestPatch(updatedMsg).catch(() => {});

  // 4. Sinkroniziraj s poslužiteljem
  safeFetchJson(
    getApiUrl('/api/chat/react'),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messageId,
        emoji,
        deviceId,
        userName,
        reactions: updatedReactions
      })
    }
  ).catch(() => {});

  return { success: true, reactions: updatedReactions };
}

/**
 * Mijenja vlastito ime korisnika u chatu i sinkronizira ga s Firestoreom i poslužiteljem
 */
export async function renameMyUserName(newName: string): Promise<{ success: boolean; userName: string; error?: string }> {
  const clean = newName.trim();
  if (!clean) return { success: false, userName: '', error: 'Ime ne može biti prazno.' };

  const deviceId = getDeviceId();
  setStoredUserName(clean);
  sharedUserNamesMap.set(deviceId, clean);
  emitToAllSubscribers();

  try {
    await setDoc(doc(db, 'licenses', deviceId), { userName: clean }, { merge: true });
  } catch {}

  try {
    await safeFetchJson<{ success: boolean; userName: string; error?: string }>(
      getApiUrl('/api/chat/rename'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, newName: clean })
      }
    );
  } catch {}

  return { success: true, userName: clean };
}

/**
 * Pokreće dijeljenu (singleton) pretplatu na Firestore i pričuvne sinkronizacijske kanale
 */
function ensureSharedSubscriptionStarted(deviceId: string): void {
  // Inicijalno napuni mapu imena iz lokalne baze licenci
  getLocalLicenses().forEach(l => {
    if (l.deviceId && l.userName) sharedUserNamesMap.set(l.deviceId, l.userName);
  });

  // Učitaj lokalni cache ako je mapa prazna
  if (sharedMessageMap.size === 0) {
    const cached = getLocalChatCache();
    cached.forEach(m => {
      if (m && m.id) sharedMessageMap.set(m.id, m);
    });
  }

  if (!sharedUnsubscribeLicenses) {
    sharedUnsubscribeLicenses = onSnapshot(collection(db, 'licenses'), snapshot => {
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data.deviceId && data.userName) {
          sharedUserNamesMap.set(data.deviceId, data.userName);
        }
        if (docSnap.id === deviceId) {
          if (data.status === 'revoked') {
            sharedIsChatBlocked = true;
            sharedBlockedReason = 'Vaša licenca je ukinuta od strane administratora.';
          } else if (data.chatEnabled === false) {
            sharedIsChatBlocked = true;
            sharedBlockedReason = 'Administrator vam je onemogućio pristup LiveChatu.';
          } else {
            sharedIsChatBlocked = false;
            sharedBlockedReason = '';
          }
          if (data.userName && data.userName !== getUserName()) {
            setStoredUserName(data.userName);
          }
        }
      });
      emitToAllSubscribers();
    }, () => {});
  }

  if (!sharedUnsubscribeMessages) {
    const q = query(
      collection(db, 'chat_messages'),
      orderBy('createdAt', 'asc'),
      limitToLast(45)
    );

    sharedUnsubscribeMessages = onSnapshot(q, snapshot => {
      snapshot.docChanges().forEach(change => {
        if (change.type === 'removed') {
          sharedMessageMap.delete(change.doc.id);
        }
      });
      snapshot.forEach(docSnap => {
        if (docSnap.id === '_room_state_') return;
        const data = docSnap.data();
        const newMsg = normalizeChatMessage(docSnap.id, data);
        sharedMessageMap.set(newMsg.id, newMsg);
      });
      emitToAllSubscribers();
    }, error => {
      console.warn('Upozorenje u Firestore live pretplati na chat (aktiviram REST PATCH pričuvu):', error);
      syncRoomStateViaRestPatch().catch(() => {});
      emitToAllSubscribers();
    });
  }

  // Pokreni pričuvnu REST PATCH sinkronizaciju s chat_room_state isključivo dok je zaslon aktivan (sprječava buđenje procesora u pozadini i trošenje baterije!)
  if (!sharedRoomPatchTimer) {
    if (typeof document === 'undefined' || !document.hidden) {
      syncRoomStateViaRestPatch().catch(() => {});
    }
    sharedRoomPatchTimer = setInterval(() => {
      if (activeSubscribers.size > 0 && (typeof document === 'undefined' || !document.hidden)) {
        syncRoomStateViaRestPatch().catch(() => {});
      }
    }, 20000);

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && activeSubscribers.size > 0) {
          syncRoomStateViaRestPatch().catch(() => {});
        }
      });
    }
  }

  // Na webu dodatno sinkroniziraj s lokalnim poslužiteljem (/api/chat/messages) samo dok je prozor vidljiv
  const isCapacitorNative = typeof window !== 'undefined' && (
    window.location.protocol === 'capacitor:' ||
    Boolean((window as any).Capacitor?.isNativePlatform?.())
  );

  if (!isCapacitorNative && !sharedPollTimer) {
    const pollServer = async () => {
      if (activeSubscribers.size === 0) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      try {
        const res = await safeFetchJson<{ success: boolean; messages?: ChatMessage[]; chatBlocked?: boolean; message?: string }>(
          getApiUrl(`/api/chat/messages?deviceId=${encodeURIComponent(deviceId)}`),
          {
            headers: { 'x-device-id': deviceId }
          }
        );
        if (res.ok && res.data) {
          if (res.data.chatBlocked) {
            sharedIsChatBlocked = true;
            sharedBlockedReason = res.data.message || 'Pristup onemogućen.';
            emitToAllSubscribers();
          } else if (Array.isArray(res.data.messages)) {
            let hasNew = false;
            res.data.messages.forEach(m => {
              if (!m || !m.id) return;
              const existing = sharedMessageMap.get(m.id);
              const existingReadLen = existing?.readBy?.length || 0;
              const newReadLen = m.readBy?.length || 0;
              const existingReactStr = JSON.stringify((existing?.reactions || []).map(r => `${r.deviceId}:${r.emoji}`));
              const newReactStr = JSON.stringify((m.reactions || []).map(r => `${r.deviceId}:${r.emoji}`));

              if (!existing || existing.text !== m.text || newReadLen > existingReadLen || existingReactStr !== newReactStr) {
                sharedMessageMap.set(m.id, normalizeChatMessage(m.id, m));
                hasNew = true;
              }
            });
            if (hasNew) emitToAllSubscribers();
          }
        }
      } catch {}
    };

    pollServer();
    sharedPollTimer = setInterval(pollServer, 10000);
  }
}

/**
 * Pretplata na poruke u stvarnom vremenu preko dijeljenog Singleton upravitelja.
 * Sve poruke i reakcije poslane od bilo kojeg korisnika odmah se sinkroniziraju na sve uređaje.
 */
export function subscribeToChatMessages(
  callback: (result: FetchChatResult) => void,
  overrideDeviceId?: string
): Unsubscribe {
  const deviceId = overrideDeviceId || getDeviceId();

  activeSubscribers.add(callback);
  ensureSharedSubscriptionStarted(deviceId);

  // Odmah pošalji trenutno stanje novom pretplatniku
  emitToAllSubscribers();
  // I odmah povuci najnovije stanje iz chat_room_state
  syncRoomStateViaRestPatch().catch(() => {});

  return () => {
    activeSubscribers.delete(callback);
    if (activeSubscribers.size === 0) {
      if (sharedPollTimer) {
        clearInterval(sharedPollTimer);
        sharedPollTimer = null;
      }
      if (sharedRoomPatchTimer) {
        clearInterval(sharedRoomPatchTimer);
        sharedRoomPatchTimer = null;
      }
      if (sharedUnsubscribeLicenses) {
        sharedUnsubscribeLicenses();
        sharedUnsubscribeLicenses = null;
      }
      if (sharedUnsubscribeMessages) {
        sharedUnsubscribeMessages();
        sharedUnsubscribeMessages = null;
      }
    }
  };
}

/**
 * Jednokratni dohvat poruka iz chata
 */
export async function fetchChatMessages(overrideDeviceId?: string): Promise<FetchChatResult> {
  const deviceId = overrideDeviceId || getDeviceId();

  try {
    const licSnap = await getDoc(doc(db, 'licenses', deviceId));
    if (licSnap.exists()) {
      const lic = licSnap.data();
      if (lic.status === 'revoked' || lic.chatEnabled === false) {
        return {
          messages: [],
          chatBlocked: true,
          message: lic.status === 'revoked' ? 'Vaša licenca je ukinuta.' : 'Pristup LiveChatu je onemogućen od strane administratora.'
        };
      }
    }
  } catch {}

  try {
    const q = query(
      collection(db, 'chat_messages'),
      orderBy('createdAt', 'asc'),
      limitToLast(45)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const msgs: ChatMessage[] = [];
      snap.forEach(d => {
        if (d.id === '_room_state_') return;
        const msg = normalizeChatMessage(d.id, d.data());
        sharedMessageMap.set(msg.id, msg);
        msgs.push(msg);
      });
      saveLocalChatCache(msgs);
      return { messages: msgs, chatBlocked: false };
    }
  } catch (e) {
    console.warn('Greška pri jednokratnom dohvatu poruka s Firestorea (koristim REST PATCH):', e);
    await syncRoomStateViaRestPatch();
  }

  const cached = getLocalChatCache();
  return {
    messages: cached,
    chatBlocked: false
  };
}

/**
 * Admin dohvat svih poruka chata
 */
export async function fetchChatMessagesForAdmin(_pin: string): Promise<ChatMessage[]> {
  try {
    const q = query(
      collection(db, 'chat_messages'),
      orderBy('createdAt', 'asc'),
      limitToLast(80)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const msgs: ChatMessage[] = [];
      snap.forEach(d => {
        if (d.id === '_room_state_') return;
        const msg = normalizeChatMessage(d.id, d.data());
        sharedMessageMap.set(msg.id, msg);
        msgs.push(msg);
      });
      saveLocalChatCache(msgs);
      return msgs;
    }
  } catch {
    await syncRoomStateViaRestPatch();
  }

  return getLocalChatCache();
}

/**
 * Šalje poruku u chat izravno u Firestore bazu, chat_room_state i poslužitelju
 */
export async function sendChatMessage(
  text: string, 
  replyTo?: ChatReplyTo
): Promise<{ success: boolean; message?: ChatMessage; error?: string }> {
  const deviceId = getDeviceId();
  let userName = sharedUserNamesMap.get(deviceId) || getUserName() || `Ribič (${deviceId.slice(-4)})`;

  if (!text || !text.trim()) {
    return { success: false, error: 'Poruka ne može biti prazna.' };
  }

  // Provjeri iz lokalne memorije licenci ako je dostupno (bez nepotrebnog čitanja ako već znamo ime)
  const localLic = getLocalLicenses().find(l => l.deviceId === deviceId);
  if (localLic) {
    if (localLic.status === 'revoked') {
      return { success: false, error: 'Vaša licenca je ukinuta od strane administratora.' };
    }
    if (localLic.chatEnabled === false) {
      return { success: false, error: 'Administrator vam je onemogućio slanje poruka u LiveChat.' };
    }
    if (localLic.userName && !localLic.userName.startsWith('Ribič (')) {
      userName = localLic.userName;
      setStoredUserName(userName);
    }
  }

  const cleanText = text.trim().slice(0, 350);
  const newMsg: ChatMessage = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    deviceId,
    userName,
    text: cleanText,
    timestamp: new Date().toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' }),
    createdAt: Date.now(),
    readBy: [{ deviceId, userName, readAt: Date.now() }],
    reactions: []
  };

  if (replyTo && replyTo.text) {
    newMsg.replyTo = {
      id: replyTo.id,
      userName: replyTo.userName,
      text: replyTo.text.slice(0, 200)
    };
  }

  // 1. Ugasi status tipkanja u pozadini jer je poruka poslana
  setMyTypingStatus(false).catch(() => {});

  // 2. Spremi u Firestore bazu (i u chat_messages i u chat_room_state za 100% otpornost na kvote)
  const firestoreData: Record<string, any> = {
    id: newMsg.id,
    deviceId: newMsg.deviceId,
    userName: newMsg.userName,
    text: newMsg.text,
    timestamp: newMsg.timestamp,
    createdAt: newMsg.createdAt,
    readBy: newMsg.readBy,
    reactions: []
  };
  if (newMsg.replyTo) {
    firestoreData.replyTo = newMsg.replyTo;
  }

  let savedToCloud = false;
  try {
    await Promise.race([
      setDoc(doc(db, 'chat_messages', newMsg.id), firestoreData),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 6000))
    ]);
    savedToCloud = true;
  } catch (err) {
    console.warn('Upozorenje pri setDoc u chat_messages, koristim REST PATCH pričuvu:', err);
  }

  // Uvijek sinkroniziraj i u chat_room_state preko REST PATCH
  const patchOk = await syncRoomStateViaRestPatch(newMsg);
  if (!savedToCloud && !patchOk) {
    return {
      success: false,
      error: 'Greška pri slanju poruke. Provjerite internetsku vezu i pokušajte ponovno.'
    };
  }

  // 3. Dodaj u dijeljenu mapu i lokalnu trajnu memoriju te emitiraj svim pretplatnicima
  sharedMessageMap.set(newMsg.id, newMsg);
  emitToAllSubscribers();

  // 4. Asinkrono pošalji i poslužitelju za sinkronizaciju
  safeFetchJson(
    getApiUrl('/api/chat/messages'),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: newMsg.id,
        createdAt: newMsg.createdAt,
        deviceId,
        activationKey: getStoredActivationKey(),
        userName,
        text: cleanText,
        replyTo: newMsg.replyTo,
        reactions: []
      })
    }
  ).catch(() => {});

  // Sinkroniziraj s nativnim servisom kako ne bi slao obavijest za vlastitu poruku
  syncLastSeenMessageToNative(newMsg.id, newMsg.createdAt).catch(() => {});

  return { 
    success: true, 
    message: newMsg 
  };
}

/**
 * Admin brisanje poruke iz Firestorea i s poslužitelja
 */
export async function deleteChatMessageAsAdmin(pin: string, messageId: string): Promise<boolean> {
  try {
    await deleteDoc(doc(db, 'chat_messages', messageId));
  } catch {}

  sharedMessageMap.delete(messageId);
  syncRoomStateViaRestPatch(undefined, messageId).catch(() => {});
  emitToAllSubscribers();

  try {
    await safeFetchJson(
      getApiUrl(`/api/admin/chat/messages/${encodeURIComponent(messageId)}`),
      {
        method: 'DELETE',
        headers: { 'x-admin-pin': pin.trim() }
      }
    );
  } catch {}

  return true;
}

/* =====================================================================
 * STATUS TIPKANJA ("KORISNIK NEŠTO PIŠE...") U STVARNOM VREMENU
 * ===================================================================== */

export async function setMyTypingStatus(isTyping: boolean): Promise<void> {
  const deviceId = getDeviceId();
  const userName = sharedUserNamesMap.get(deviceId) || getUserName();
  try {
    const typingRef = doc(db, 'chat_typing', deviceId);
    await setDoc(typingRef, {
      deviceId,
      userName,
      isTyping,
      updatedAt: Date.now()
    }, { merge: true });
  } catch {}
}

export function subscribeToTypingStatus(
  callback: (typingUsers: TypingUser[]) => void
): Unsubscribe {
  const myDeviceId = getDeviceId();

  const unsubscribe = onSnapshot(collection(db, 'chat_typing'), snapshot => {
    const now = Date.now();
    const active: TypingUser[] = [];

    snapshot.forEach(docSnap => {
      if (docSnap.id === myDeviceId) return;
      const data = docSnap.data();
      if (data.isTyping === true && (now - (data.updatedAt || 0) < 5000)) {
        active.push({
          deviceId: docSnap.id,
          userName: sharedUserNamesMap.get(docSnap.id) || data.userName || 'Ribič'
        });
      }
    });

    callback(active);
  }, () => {
    callback([]);
  });

  return unsubscribe;
}

/**
 * Administratorsko brisanje cijele povijesti chata za sve korisnike (Clear History)
 */
export async function clearAllChatHistoryAsAdmin(pin?: string): Promise<{ success: boolean; error?: string }> {
  try {
    try {
      const snap = await getDocs(collection(db, 'chat_messages'));
      const deletePromises = snap.docs.map(d => deleteDoc(doc(db, 'chat_messages', d.id)));
      await Promise.all(deletePromises);
    } catch (err) {
      console.warn('Upozorenje pri direktnom Firestore brisanju:', err);
    }

    // Očisti i chat_room_state dokument
    try {
      await setDoc(doc(db, 'app_updates', 'chat_room_state'), { _ping: Date.now() });
    } catch {}

    try {
      await safeFetchJson(getApiUrl('/api/admin/chat/clear'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-pin': pin || '2026'
        },
        body: JSON.stringify({ pin: pin || '2026' })
      });
    } catch (err) {
      console.warn('Upozorenje pri pozivu API-ja za brisanje chata:', err);
    }

    sharedMessageMap.clear();
    saveLocalChatCache([]);
    emitToAllSubscribers();

    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('ribo_last_read_chat_time');
      } catch {}
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Greška pri brisanju povijesti chata' };
  }
}
