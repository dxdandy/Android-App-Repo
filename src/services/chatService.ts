import { 
  getDeviceId, 
  getStoredActivationKey, 
  setStoredUserName, 
  getUserName, 
  getApiUrl, 
  safeFetchJson 
} from './licenseService';
import { updateAppBadge } from './notificationService';
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

export { updateAppBadge };

export interface ChatReadReceipt {
  deviceId: string;
  userName: string;
  readAt: number;
}

export interface ChatMessage {
  id: string;
  deviceId: string;
  userName: string;
  text: string;
  timestamp: string;
  createdAt: number;
  readBy?: ChatReadReceipt[];
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
    localStorage.setItem(LOCAL_CHAT_CACHE_KEY, JSON.stringify(msgs.slice(-100)));
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
 * Označava sve trenutne poruke pročitanima, šalje potvrdu čitanja i uklanja obavijest s ikone
 */
export function markChatAsRead(messages?: ChatMessage[]): void {
  if (typeof window === 'undefined') return;
  try {
    let latestTime = Date.now();
    if (messages && messages.length > 0) {
      const maxMsgTime = Math.max(...messages.map(m => m.createdAt || 0));
      if (maxMsgTime > 0) latestTime = Math.max(latestTime, maxMsgTime);
      
      const otherUserMsgIds = messages
        .filter(m => m.deviceId !== getDeviceId())
        .map(m => m.id);
      if (otherUserMsgIds.length > 0) {
        sendReadReceipts(otherUserMsgIds).catch(() => {});
      }
    }
    localStorage.setItem(LAST_READ_CHAT_TIME_KEY, String(latestTime));
    updateAppBadge(0);
  } catch {}
}

/**
 * Šalje potvrdu čitanja za poruke
 */
export async function sendReadReceipts(messageIds?: string[]): Promise<void> {
  const deviceId = getDeviceId();
  const userName = getUserName();
  if (!messageIds || messageIds.length === 0) return;

  // 1. Zapiši čitanje u Firestore za svaku poruku
  try {
    for (const msgId of messageIds.slice(-20)) {
      const msgRef = doc(db, 'chat_messages', msgId);
      const snap = await getDoc(msgRef);
      if (snap.exists()) {
        const data = snap.data();
        const existingReceipts: ChatReadReceipt[] = data.readBy || [];
        if (!existingReceipts.some(r => r.deviceId === deviceId)) {
          const updated = [...existingReceipts, { deviceId, userName, readAt: Date.now() }];
          await setDoc(msgRef, { readBy: updated }, { merge: true });
        }
      }
    }
  } catch {}

  // 2. Također pošalji poslužitelju
  try {
    await safeFetchJson(
      getApiUrl('/api/chat/read'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, userName, messageIds })
      }
    );
  } catch {}
}

/**
 * Mijenja vlastito ime korisnika u chatu i sinkronizira ga s Firestoreom i poslužiteljem
 */
export async function renameMyUserName(newName: string): Promise<{ success: boolean; userName: string; error?: string }> {
  const clean = newName.trim();
  if (!clean) return { success: false, userName: '', error: 'Ime ne može biti prazno.' };

  const deviceId = getDeviceId();
  setStoredUserName(clean);

  // Ažuriraj u Firestore licenci
  try {
    await setDoc(doc(db, 'licenses', deviceId), { userName: clean }, { merge: true });
  } catch {}

  // Pošalji na poslužitelj
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
 * Pretplata na poruke u stvarnom vremenu preko Firestore baze.
 * Sve poruke poslane od bilo kojeg korisnika odmah se sinkroniziraju na sve uređaje.
 */
export function subscribeToChatMessages(
  callback: (result: FetchChatResult) => void,
  overrideDeviceId?: string
): Unsubscribe {
  const deviceId = overrideDeviceId || getDeviceId();
  let isChatBlocked = false;
  let blockedReason = '';

  // 1. Provjeri status ovlasti u Firestore bazi za ovog korisnika
  const licenseRef = doc(db, 'licenses', deviceId);
  const unsubscribeLicense = onSnapshot(licenseRef, docSnap => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data.status === 'revoked') {
        isChatBlocked = true;
        blockedReason = 'Vaša licenca je ukinuta od strane administratora.';
      } else if (data.chatEnabled === false) {
        isChatBlocked = true;
        blockedReason = 'Administrator vam je onemogućio pristup LiveChatu.';
      } else {
        isChatBlocked = false;
        blockedReason = '';
      }
    }
  }, () => {
    // Ako nema pristupa licenci, dopusti lokalno
  });

  // 2. Slušaj promjene u kolekciji chat_messages
  const q = query(
    collection(db, 'chat_messages'),
    orderBy('createdAt', 'asc'),
    limitToLast(120)
  );

  const unsubscribeMessages = onSnapshot(q, snapshot => {
    if (isChatBlocked) {
      callback({
        messages: [],
        chatBlocked: true,
        message: blockedReason || 'Pristup LiveChatu je onemogućen.'
      });
      return;
    }

    const msgs: ChatMessage[] = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      msgs.push({
        id: docSnap.id,
        deviceId: data.deviceId || '',
        userName: data.userName || 'Ribič',
        text: data.text || '',
        timestamp: data.timestamp || '',
        createdAt: data.createdAt || 0,
        readBy: data.readBy || []
      });
    });

    saveLocalChatCache(msgs);

    callback({
      messages: msgs,
      chatBlocked: false
    });
  }, error => {
    console.warn('Greška u Firestore live pretplati na chat:', error);
    // U slučaju offline rada vrati lokalnu predmemoriju
    const cached = getLocalChatCache();
    callback({
      messages: cached,
      chatBlocked: isChatBlocked,
      message: isChatBlocked ? blockedReason : undefined
    });
  });

  return () => {
    unsubscribeLicense();
    unsubscribeMessages();
  };
}

/**
 * Jednokratni dohvat poruka iz chata
 */
export async function fetchChatMessages(overrideDeviceId?: string): Promise<FetchChatResult> {
  const deviceId = overrideDeviceId || getDeviceId();

  // 1. Provjeri dozvolu u Firestore
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

  // 2. Dohvati poruke iz Firestorea
  try {
    const q = query(
      collection(db, 'chat_messages'),
      orderBy('createdAt', 'asc'),
      limitToLast(60)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const msgs: ChatMessage[] = [];
      snap.forEach(d => {
        const data = d.data();
        msgs.push({
          id: d.id,
          deviceId: data.deviceId || '',
          userName: data.userName || 'Ribič',
          text: data.text || '',
          timestamp: data.timestamp || '',
          createdAt: data.createdAt || 0,
          readBy: data.readBy || []
        });
      });
      saveLocalChatCache(msgs);
      return { messages: msgs, chatBlocked: false };
    }
  } catch (e) {
    console.warn('Greška pri jednokratnom dohvatu poruka s Firestorea:', e);
  }

  // 3. Fallback na lokalni cache
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
  try {
    const q = query(
      collection(db, 'chat_messages'),
      orderBy('createdAt', 'asc'),
      limitToLast(150)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const msgs: ChatMessage[] = [];
      snap.forEach(d => {
        const data = d.data();
        msgs.push({
          id: d.id,
          deviceId: data.deviceId || '',
          userName: data.userName || 'Ribič',
          text: data.text || '',
          timestamp: data.timestamp || '',
          createdAt: data.createdAt || 0,
          readBy: data.readBy || []
        });
      });
      saveLocalChatCache(msgs);
      return msgs;
    }
  } catch {}

  return getLocalChatCache();
}

/**
 * Šalje poruku u chat izravno u Firestore bazu i poslužitelju
 */
export async function sendChatMessage(text: string): Promise<{ success: boolean; message?: ChatMessage; error?: string }> {
  const deviceId = getDeviceId();
  const userName = getUserName() || `Ribič (${deviceId.slice(-4)})`;

  if (!text || !text.trim()) {
    return { success: false, error: 'Poruka ne može biti prazna.' };
  }

  // Provjeri status ovlasti u Firestore s brzim timeoutom od 1.5s tako da nikada ne zablokira
  try {
    const licSnap = await Promise.race([
      getDoc(doc(db, 'licenses', deviceId)),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500))
    ]);
    if (licSnap && (licSnap as any).exists && (licSnap as any).exists()) {
      const lic = (licSnap as any).data();
      if (lic.status === 'revoked') {
        return { success: false, error: 'Vaša licenca je ukinuta od strane administratora.' };
      }
      if (lic.chatEnabled === false) {
        return { success: false, error: 'Administrator vam je onemogućio slanje poruka u LiveChat.' };
      }
    }
  } catch {}

  const cleanText = text.trim().slice(0, 350);
  const newMsg: ChatMessage = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    deviceId,
    userName,
    text: cleanText,
    timestamp: new Date().toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' }),
    createdAt: Date.now(),
    readBy: [{ deviceId, userName, readAt: Date.now() }]
  };

  // 1. Odmah spremi lokalno u predmemoriju uređaja
  const current = getLocalChatCache();
  current.push(newMsg);
  saveLocalChatCache(current);

  // 2. Ugasi status tipkanja u pozadini jer je poruka poslana
  setMyTypingStatus(false).catch(() => {});

  // 3. Spremi izravno u Firestore (odmah vidljivo svim ostalim korisnicima)
  try {
    await Promise.race([
      setDoc(doc(db, 'chat_messages', newMsg.id), newMsg),
      new Promise((resolve) => setTimeout(resolve, 3000))
    ]);
  } catch (err: any) {
    console.warn('Greška pri spremanju u Firestore chat:', err);
  }

  // 4. Asinkrono pošalji i poslužitelju (potpuno u pozadini bez čekanja)
  safeFetchJson(
    getApiUrl('/api/chat/messages'),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId,
        activationKey: getStoredActivationKey(),
        userName,
        text: cleanText
      })
    }
  ).catch(() => {});

  return { 
    success: true, 
    message: newMsg 
  };
}

/**
 * Admin brisanje poruke iz Firestorea i s poslužitelja
 */
export async function deleteChatMessageAsAdmin(pin: string, messageId: string): Promise<boolean> {
  // Obriši iz Firestore
  try {
    await deleteDoc(doc(db, 'chat_messages', messageId));
  } catch {}

  // Ukloni lokalno
  const filtered = getLocalChatCache().filter(m => m.id !== messageId);
  saveLocalChatCache(filtered);

  // Obriši na poslužitelju
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

/**
 * Zapisuje status tipkanja trenutnog korisnika u Firestore
 */
export async function setMyTypingStatus(isTyping: boolean): Promise<void> {
  const deviceId = getDeviceId();
  const userName = getUserName();
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

/**
 * Pretplata na status tipkanja drugih korisnika u stvarnom vremenu
 */
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
      // Aktivno tipka ako je isTyping true i zadnje ažurirano unutar zadnjih 5 sekundi
      if (data.isTyping === true && (now - (data.updatedAt || 0) < 5000)) {
        active.push({
          deviceId: docSnap.id,
          userName: data.userName || 'Ribič'
        });
      }
    });

    callback(active);
  }, () => {
    callback([]);
  });

  return unsubscribe;
}
