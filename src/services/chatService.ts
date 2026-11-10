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
  imageUrl?: string;
  timestamp: string;
  createdAt: number;
  editedAt?: number;
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

export interface OnlineUser {
  deviceId: string;
  userName: string;
  lastActiveAt: number;
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
let sharedUnsubscribeRoomDoc: Unsubscribe | null = null;
let sharedPollTimer: any = null;
let sharedRoomPatchTimer: any = null;
let sharedIsChatBlocked = false;
let sharedBlockedReason = '';
let isChatModalFastMode = false;
let isPatchInFlight = false;

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
    localStorage.setItem(LOCAL_CHAT_CACHE_KEY, JSON.stringify(msgs.slice(-60)));
  } catch {}
}

/**
 * Komprimira odabranu fotografiju (ulov ili stanje vode na Dunavu) na klijentu
 * u lagani JPEG Data URL (max 680px, ~35-65 KB) za trenutno slanje u LiveChat
 */
export function compressImageForChat(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('Odaberite valjanu sliku (JPG, PNG, WEBP).'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Greška pri čitanju slike.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Neuspješno učitavanje slike.'));
      img.onload = () => {
        try {
          const maxDim = 680;
          let width = img.width;
          let height = img.height;

          if (width > height && width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else if (height >= width && height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Greška pri obradi slike.'));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          let dataUrl = canvas.toDataURL('image/jpeg', 0.72);
          if (dataUrl.length > 110000) {
            dataUrl = canvas.toDataURL('image/jpeg', 0.56);
          }
          resolve(dataUrl);
        } catch (err) {
          reject(err);
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
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
    text: data.text || (data.imageUrl ? '📷 Fotografija s Dunava' : ''),
    imageUrl: data.imageUrl || undefined,
    timestamp: data.timestamp || '',
    createdAt: Number(data.createdAt) || 0,
    editedAt: data.editedAt ? Number(data.editedAt) : undefined,
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
    .filter(m => m && m.id && m.id !== '_room_state_' && (m.text || m.imageUrl))
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
 * Obrađuje polja iz chat_room_state dokumenta (iz onSnapshot ili REST PATCH odgovora)
 */
function ingestRoomStateFields(docFields: Record<string, any>, isRestFormat: boolean): boolean {
  let hasChanges = false;
  const roomEntries: { key: string; msg: ChatMessage }[] = [];

  for (const [k, valObj] of Object.entries(docFields || {})) {
    if (!k.startsWith('m_')) continue;
    const rawStr = isRestFormat ? (valObj as any)?.stringValue : (typeof valObj === 'string' ? valObj : null);
    if (!rawStr) continue;
    try {
      const parsed = JSON.parse(rawStr) as ChatMessage;
      if (parsed && parsed.id && (parsed.text || parsed.imageUrl)) {
        roomEntries.push({ key: k, msg: parsed });
        const existing = sharedMessageMap.get(parsed.id);
        const norm = normalizeChatMessage(parsed.id, parsed);
        if (
          !existing ||
          existing.text !== norm.text ||
          existing.editedAt !== norm.editedAt ||
          existing.imageUrl !== norm.imageUrl ||
          (existing.readBy?.length || 0) !== (norm.readBy?.length || 0) ||
          JSON.stringify(existing.reactions || []) !== JSON.stringify(norm.reactions || [])
        ) {
          sharedMessageMap.set(norm.id, norm);
          hasChanges = true;
        }
      }
    } catch {}
  }

  return hasChanges;
}

/**
 * Sinkronizira poruku ili stanje chata preko jedinstvenog dokumenta app_updates/chat_room_state
 * koristeći Firestore REST PATCH (radi 100% trenutno čak i ako je dnevna kvota čitanja iscrpljena!)
 */
async function syncRoomStateViaRestPatch(changedMsg?: ChatMessage, deletedMsgId?: string): Promise<boolean> {
  if (!changedMsg && !deletedMsgId && isPatchInFlight) {
    return true;
  }
  if (!changedMsg && !deletedMsgId) {
    isPatchInFlight = true;
  }

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

    const hasChanges = ingestRoomStateFields(docFields, true);

    // Provjeri broj zapisa za održavanje kompaktnosti
    const mKeys = Object.keys(docFields).filter(k => k.startsWith('m_'));
    if (mKeys.length === 0 && sharedMessageMap.size > 0 && !changedMsg && !deletedMsgId) {
      const recent = Array.from(sharedMessageMap.values())
        .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
        .slice(-25);
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

    if (mKeys.length > 40 && changedMsg) {
      const roomEntries: { key: string; createdAt: number }[] = [];
      for (const k of mKeys) {
        try {
          const parsed = JSON.parse(docFields[k]?.stringValue || '{}');
          roomEntries.push({ key: k, createdAt: Number(parsed?.createdAt) || 0 });
        } catch {}
      }
      roomEntries.sort((a, b) => a.createdAt - b.createdAt);
      const toPrune = roomEntries.slice(0, roomEntries.length - 35);
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
  } finally {
    if (!changedMsg && !deletedMsgId) {
      isPatchInFlight = false;
    }
  }
}

/**
 * Uključuje brzu sinkronizaciju (svake 2.5 sekunde) dok je korisnik u otvorenom LiveChatu,
 * a izvan chata 5 sekundi isključivo dok je zaslon upaljen (0 buđenja u pozadini / deep sleepu!).
 */
export function setChatModalFastSync(isOpen: boolean): void {
  isChatModalFastMode = isOpen;
  restartRoomPatchTimer();
  if (isOpen && (typeof document === 'undefined' || !document.hidden)) {
    syncRoomStateViaRestPatch().catch(() => {});
  }
}

function restartRoomPatchTimer(): void {
  if (sharedRoomPatchTimer) {
    clearInterval(sharedRoomPatchTimer);
    sharedRoomPatchTimer = null;
  }
  if (activeSubscribers.size === 0) return;

  const intervalMs = isChatModalFastMode ? 2500 : 5000;
  sharedRoomPatchTimer = setInterval(() => {
    // Izvršava se ISKLJUČIVO dok je ekran upaljen i aplikacija vidljiva (!document.hidden)
    // Time se uopće ne budi procesor u stanju mirovanja i ne uzrokuje "Frequent wakeups"
    if (activeSubscribers.size > 0 && (typeof document === 'undefined' || !document.hidden)) {
      syncRoomStateViaRestPatch().catch(() => {});
    }
  }, intervalMs);
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
 * Označava sve trenutne poruke pročitanima, šalje potvrdu čitanja samo za stvarno nepročitane poruke
 */
export function markChatAsRead(messages?: ChatMessage[]): void {
  if (typeof window === 'undefined') return;
  try {
    const myId = getDeviceId();
    let latestTime = Date.now();

    if (messages && messages.length > 0) {
      const maxMsgTime = Math.max(...messages.map(m => m.createdAt || 0));
      if (maxMsgTime > 0) latestTime = Math.max(latestTime, maxMsgTime);

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
        setDoc(doc(db, 'chat_messages', msgId), { readBy: updatedReceipts }, { merge: true }).catch(() => {});
      }
    }
  } catch {}

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
    updatedReactions = currentReactions.filter((_, idx) => idx !== existingIdx);
  } else if (existingIdx >= 0) {
    updatedReactions = [...currentReactions];
    updatedReactions[existingIdx] = {
      emoji,
      deviceId,
      userName,
      createdAt: Date.now()
    };
  } else {
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

  sharedMessageMap.set(messageId, updatedMsg);
  emitToAllSubscribers();

  setDoc(doc(db, 'chat_messages', messageId), { reactions: updatedReactions }, { merge: true }).catch(() => {});
  syncRoomStateViaRestPatch(updatedMsg).catch(() => {});

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
 * Uređuje (ispravlja) već poslanu vlastitu poruku u LiveChatu i odmah sinkronizira sa svima
 */
export async function editMyChatMessage(
  messageId: string,
  newText: string
): Promise<{ success: boolean; message?: ChatMessage; error?: string }> {
  const cleanText = (newText || '').trim().slice(0, 350);
  if (!messageId || !cleanText) {
    return { success: false, error: 'Tekst poruke ne može biti prazan.' };
  }

  const myDeviceId = getDeviceId();
  let targetMsg = sharedMessageMap.get(messageId);
  if (!targetMsg) {
    const cached = getLocalChatCache();
    targetMsg = cached.find(m => m.id === messageId);
  }
  if (!targetMsg) {
    return { success: false, error: 'Poruka nije pronađena.' };
  }

  if (targetMsg.deviceId !== myDeviceId && !isAdminUnlocked()) {
    return { success: false, error: 'Možete uređivati samo vlastite poruke.' };
  }

  const editedAt = Date.now();
  const updatedMsg: ChatMessage = {
    ...targetMsg,
    text: cleanText,
    editedAt
  };

  // Odmah prikaži ispravljenu poruku lokalno
  sharedMessageMap.set(messageId, updatedMsg);
  emitToAllSubscribers();

  // Paralelno sinkroniziraj preko svih kanala za trenutačnu isporuku
  const patchPromise = syncRoomStateViaRestPatch(updatedMsg);
  const firestorePromise = Promise.race([
    setDoc(doc(db, 'chat_messages', messageId), { text: cleanText, editedAt }, { merge: true }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2500))
  ]).catch(() => false);

  safeFetchJson(
    getApiUrl('/api/chat/edit'),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messageId,
        deviceId: myDeviceId,
        newText: cleanText,
        editedAt
      })
    }
  ).catch(() => {});

  await Promise.allSettled([patchPromise, firestorePromise]);

  return {
    success: true,
    message: updatedMsg
  };
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
  getLocalLicenses().forEach(l => {
    if (l.deviceId && l.userName) sharedUserNamesMap.set(l.deviceId, l.userName);
  });

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

  // Izravna real-time pretplata na jedan dokument chat_room_state za trenutačni primitak (<200ms)
  if (!sharedUnsubscribeRoomDoc) {
    sharedUnsubscribeRoomDoc = onSnapshot(doc(db, 'app_updates', 'chat_room_state'), docSnap => {
      if (docSnap.exists()) {
        const data = docSnap.data() || {};
        if (ingestRoomStateFields(data, false)) {
          emitToAllSubscribers();
        }
      }
    }, () => {});
  }

  if (!sharedRoomPatchTimer) {
    if (typeof document === 'undefined' || !document.hidden) {
      syncRoomStateViaRestPatch().catch(() => {});
    }
    restartRoomPatchTimer();

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && activeSubscribers.size > 0) {
          syncRoomStateViaRestPatch().catch(() => {});
        }
      });
    }
  }

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

              if (
                !existing ||
                existing.text !== m.text ||
                existing.editedAt !== m.editedAt ||
                existing.imageUrl !== m.imageUrl ||
                newReadLen > existingReadLen ||
                existingReactStr !== newReactStr
              ) {
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
    sharedPollTimer = setInterval(pollServer, 4000);
  }
}

/**
 * Pretplata na poruke u stvarnom vremenu preko dijeljenog Singleton upravitelja.
 */
export function subscribeToChatMessages(
  callback: (result: FetchChatResult) => void,
  overrideDeviceId?: string
): Unsubscribe {
  const deviceId = overrideDeviceId || getDeviceId();

  activeSubscribers.add(callback);
  ensureSharedSubscriptionStarted(deviceId);

  emitToAllSubscribers();
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
      if (sharedUnsubscribeRoomDoc) {
        sharedUnsubscribeRoomDoc();
        sharedUnsubscribeRoomDoc = null;
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
 * Šalje poruku (i/ili fotografiju s vode) u chat s trenutačnom paralelnom sinkronizacijom bez kašnjenja
 */
export async function sendChatMessage(
  text: string, 
  replyTo?: ChatReplyTo,
  imageUrl?: string
): Promise<{ success: boolean; message?: ChatMessage; error?: string }> {
  const deviceId = getDeviceId();
  let userName = sharedUserNamesMap.get(deviceId) || getUserName() || `Ribič (${deviceId.slice(-4)})`;

  if ((!text || !text.trim()) && !imageUrl) {
    return { success: false, error: 'Poruka ili fotografija ne mogu biti prazni.' };
  }

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

  const cleanText = text && text.trim() ? text.trim().slice(0, 350) : (imageUrl ? '📷 Fotografija s Dunava' : '');
  const newMsg: ChatMessage = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    deviceId,
    userName,
    text: cleanText,
    imageUrl: imageUrl || undefined,
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

  setMyTypingStatus(false).catch(() => {});

  // Odmah prikaži poruku pošiljatelju (0ms odgode)
  sharedMessageMap.set(newMsg.id, newMsg);
  emitToAllSubscribers();

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
  if (newMsg.imageUrl) {
    firestoreData.imageUrl = newMsg.imageUrl;
  }
  if (newMsg.replyTo) {
    firestoreData.replyTo = newMsg.replyTo;
  }

  // PARALELNO pošalji u chat_room_state (REST PATCH ~150ms) i u chat_messages (Firestore SDK)
  // tako da više nikada ne čeka 6 sekundi na setDoc prije nego što drugi korisnici dobiju poruku!
  const patchPromise = syncRoomStateViaRestPatch(newMsg);
  const setDocPromise = Promise.race([
    setDoc(doc(db, 'chat_messages', newMsg.id), firestoreData).then(() => true),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2500))
  ]).catch(() => false);

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
        imageUrl: newMsg.imageUrl,
        replyTo: newMsg.replyTo,
        reactions: []
      })
    }
  ).catch(() => {});

  syncLastSeenMessageToNative(newMsg.id, newMsg.createdAt).catch(() => {});

  const [patchOk, savedToCloud] = await Promise.all([patchPromise, setDocPromise]);
  if (!patchOk && !savedToCloud) {
    return {
      success: false,
      error: 'Greška pri slanju poruke. Provjerite internetsku vezu i pokušajte ponovno.'
    };
  }

  return { 
    success: true, 
    message: newMsg 
  };
}

/**
 * Brisanje poruke iz LiveChata:
 * - Korisnik može obrisati svoju poruku
 * - Administrator može obrisati bilo čiju poruku (i svoju i od bilo kojeg korisnika)
 * - Poruka se uklanja trajno bez ikakvog traga
 */
export async function deleteChatMessage(
  messageId: string
): Promise<{ success: boolean; error?: string }> {
  if (!messageId) {
    return { success: false, error: 'Nedostaje ID poruke za brisanje.' };
  }

  const myDeviceId = getDeviceId();
  let targetMsg = sharedMessageMap.get(messageId);
  if (!targetMsg) {
    const cached = getLocalChatCache();
    targetMsg = cached.find(m => m.id === messageId);
  }

  const isAdmin = isAdminUnlocked() || myDeviceId === 'RP-ADMIN';

  if (targetMsg && targetMsg.deviceId !== myDeviceId && !isAdmin) {
    return { success: false, error: 'Možete obrisati samo vlastite poruke.' };
  }

  // Odmah ukloni poruku lokalno (0ms kašnjenja, bez ikakvog traga)
  sharedMessageMap.delete(messageId);
  const updatedCache = getLocalChatCache().filter(m => m.id !== messageId);
  saveLocalChatCache(updatedCache);
  emitToAllSubscribers();

  // Sinkroniziraj uklanjanje kroz sve kanale (Firestore doc, REST patch i backend poslužitelj)
  const restPatchPromise = syncRoomStateViaRestPatch(undefined, messageId).catch(() => false);
  const firestoreDeletePromise = Promise.race([
    deleteDoc(doc(db, 'chat_messages', messageId)),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2500))
  ]).catch(() => false);

  safeFetchJson(
    getApiUrl(`/api/chat/messages/${encodeURIComponent(messageId)}?deviceId=${encodeURIComponent(myDeviceId)}`),
    {
      method: 'DELETE',
      headers: {
        'x-device-id': myDeviceId,
        'x-admin-pin': isAdmin ? '2026' : ''
      }
    }
  ).catch(() => {});

  await Promise.allSettled([restPatchPromise, firestoreDeletePromise]);

  return { success: true };
}

/**
 * Admin brisanje poruke iz Firestorea i s poslužitelja
 */
export async function deleteChatMessageAsAdmin(pin: string, messageId: string): Promise<boolean> {
  const res = await deleteChatMessage(messageId);
  if (pin) {
    try {
      await safeFetchJson(
        getApiUrl(`/api/admin/chat/messages/${encodeURIComponent(messageId)}`),
        {
          method: 'DELETE',
          headers: { 'x-admin-pin': pin.trim() }
        }
      );
    } catch {}
  }
  return res.success;
}

/* =====================================================================
 * STATUS TIPKANJA ("KORISNIK NEŠTO PIŠE...") I PRISUTNOSTI ("TKO JE ONLINE")
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
      lastActiveAt: Date.now(),
      updatedAt: Date.now()
    }, { merge: true });
  } catch {}
}

/**
 * Označava da je korisnik trenutno aktivan u LiveChatu ("Na vodi / Online")
 */
export async function pingMyOnlinePresence(): Promise<void> {
  const deviceId = getDeviceId();
  const userName = sharedUserNamesMap.get(deviceId) || getUserName();
  try {
    const typingRef = doc(db, 'chat_typing', deviceId);
    await setDoc(typingRef, {
      deviceId,
      userName,
      lastActiveAt: Date.now(),
      updatedAt: Date.now()
    }, { merge: true });
  } catch {}
}

export function subscribeToTypingStatus(
  callback: (typingUsers: TypingUser[], onlineUsers?: OnlineUser[]) => void
): Unsubscribe {
  const myDeviceId = getDeviceId();

  const unsubscribe = onSnapshot(collection(db, 'chat_typing'), snapshot => {
    const now = Date.now();
    const activeTypers: TypingUser[] = [];
    const activeOnline: OnlineUser[] = [];

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const resolvedName = sharedUserNamesMap.get(docSnap.id) || data.userName || 'Ribič';
      const lastTime = Number(data.lastActiveAt || data.updatedAt || 0);

      // Korisnici aktivni u zadnjih 5 minuta smatraju se "Online / Na vodi"
      if (now - lastTime < 5 * 60 * 1000) {
        activeOnline.push({
          deviceId: docSnap.id,
          userName: resolvedName,
          lastActiveAt: lastTime
        });
      }

      if (docSnap.id === myDeviceId) return;
      if (data.isTyping === true && (now - (data.updatedAt || 0) < 5000)) {
        activeTypers.push({
          deviceId: docSnap.id,
          userName: resolvedName
        });
      }
    });

    callback(activeTypers, activeOnline);
  }, () => {
    callback([], []);
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
