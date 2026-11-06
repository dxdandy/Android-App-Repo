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
  let active = true;

  // Mapa poruka sjedinjena iz svih kanala (Firestore + lokalni cache + poslužitelj)
  const messageMap = new Map<string, ChatMessage>();
  // Službena imena iz centralnog registra licenci: deviceId -> userName
  const userNamesMap = new Map<string, string>();

  // Inicijalno napuni mapu imena iz lokalne baze licenci
  getLocalLicenses().forEach(l => {
    if (l.deviceId && l.userName) userNamesMap.set(l.deviceId, l.userName);
  });

  const emitMerged = () => {
    if (!active) return;
    if (isChatBlocked) {
      callback({
        messages: [],
        chatBlocked: true,
        message: blockedReason || 'Pristup LiveChatu je onemogućen.'
      });
      return;
    }
    const sorted = Array.from(messageMap.values())
      .map(msg => {
        const officialName = userNamesMap.get(msg.deviceId);
        return {
          ...msg,
          userName: officialName || msg.userName,
          readBy: (msg.readBy || []).map(r => ({
            ...r,
            userName: userNamesMap.get(r.deviceId) || r.userName
          }))
        };
      })
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

    saveLocalChatCache(sorted);
    callback({
      messages: sorted,
      chatBlocked: false
    });
  };

  // Učitaj odmah lokalni cache tako da korisnik odmah vidi sve postojeće poruke
  const cached = getLocalChatCache();
  cached.forEach(m => messageMap.set(m.id, m));
  if (cached.length > 0) {
    emitMerged();
  }

  // 1. Slušaj promjene u bazi licenci u Firestore oblaku u stvarnom vremenu.
  // Čim admin promijeni ime bilo kojem ribiču, u istoj sekundi se na svim uređajima
  // ažurira ime na svim porukama u LiveChatu!
  const unsubscribeAllLicenses = onSnapshot(collection(db, 'licenses'), snapshot => {
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (data.deviceId && data.userName) {
        userNamesMap.set(data.deviceId, data.userName);
      }
      // Ako je ovo vlastiti uređaj, provjeri status ovlasti i ažurirano ime
      if (docSnap.id === deviceId) {
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
        if (data.userName && data.userName !== getUserName()) {
          setStoredUserName(data.userName);
        }
      }
    });
    emitMerged();
  }, () => {
    // Tihi fallback ako nema pristupa
  });

  // 2. Slušaj promjene u kolekciji chat_messages u Firestore bazi
  const q = query(
    collection(db, 'chat_messages'),
    orderBy('createdAt', 'asc'),
    limitToLast(120)
  );

  const unsubscribeMessages = onSnapshot(q, snapshot => {
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const newMsg: ChatMessage = {
        id: docSnap.id,
        deviceId: data.deviceId || '',
        userName: userNamesMap.get(data.deviceId) || data.userName || 'Ribič',
        text: data.text || '',
        timestamp: data.timestamp || '',
        createdAt: data.createdAt || 0,
        readBy: data.readBy || []
      };
      messageMap.set(newMsg.id, newMsg);
    });
    emitMerged();
  }, error => {
    console.warn('Greška u Firestore live pretplati na chat:', error);
    emitMerged();
  });

  // 3. Dodatna periodička sinkronizacija s poslužiteljem (/api/chat/messages) za web okruženje
  const isCapacitorNative = typeof window !== 'undefined' && (
    window.location.protocol === 'capacitor:' ||
    Boolean((window as any).Capacitor?.isNativePlatform?.())
  );

  let pollTimer: any = null;
  const pollServer = async () => {
    if (!active) return;
    try {
      const res = await safeFetchJson<{ success: boolean; messages?: ChatMessage[]; chatBlocked?: boolean; message?: string }>(
        getApiUrl(`/api/chat/messages?deviceId=${encodeURIComponent(deviceId)}`),
        {
          headers: { 'x-device-id': deviceId }
        }
      );
      if (res.ok && res.data) {
        if (res.data.chatBlocked) {
          isChatBlocked = true;
          blockedReason = res.data.message || 'Pristup onemogućen.';
        }
        if (Array.isArray(res.data.messages)) {
          let hasNew = false;
          res.data.messages.forEach(m => {
            const existing = messageMap.get(m.id);
            if (!existing || JSON.stringify(existing.readBy) !== JSON.stringify(m.readBy)) {
              messageMap.set(m.id, m);
              hasNew = true;
            }
          });
          if (hasNew) emitMerged();
        }
      }
    } catch {}
  };

  if (!isCapacitorNative) {
    pollServer();
    pollTimer = setInterval(pollServer, 4000);
  }

  return () => {
    active = false;
    if (pollTimer) clearInterval(pollTimer);
    unsubscribeAllLicenses();
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

  // Provjeri status ovlasti u Firestore licenci
  try {
    const licSnap = await Promise.race([
      getDoc(doc(db, 'licenses', deviceId)),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 1800))
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

  // 1. Ugasi status tipkanja u pozadini jer je poruka poslana
  setMyTypingStatus(false).catch(() => {});

  // 2. Spremi izravno u Firestore bazu (odmah vidljivo svim ostalim korisnicima)
  try {
    await Promise.race([
      setDoc(doc(db, 'chat_messages', newMsg.id), newMsg),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Mrežno slanje je isteklo (provjerite internet vezu).')), 7500))
    ]);
  } catch (err: any) {
    console.error('Greška pri spremanju u Firestore chat:', err);
    return {
      success: false,
      error: err?.message || 'Greška pri slanju poruke. Provjerite internetsku vezu i pokušajte ponovno.'
    };
  }

  // 3. Tek nakon što je Firestore potvrdio uspješno spremanje, dodaj u lokalnu trajnu memoriju
  const current = getLocalChatCache();
  if (!current.some(m => m.id === newMsg.id)) {
    current.push(newMsg);
    saveLocalChatCache(current);
  }

  // 4. Asinkrono pošalji i poslužitelju za sinkronizaciju (fire-and-forget)
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

/**
 * Administratorsko brisanje cijele povijesti chata za sve korisnike (Clear History)
 */
export async function clearAllChatHistoryAsAdmin(pin?: string): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Obriši sve dokumente u Firestore kolekciji 'chat_messages'
    try {
      const snap = await getDocs(collection(db, 'chat_messages'));
      const deletePromises = snap.docs.map(d => deleteDoc(doc(db, 'chat_messages', d.id)));
      await Promise.all(deletePromises);
    } catch (err) {
      console.warn('Upozorenje pri direktnom Firestore brisanju:', err);
    }

    // 2. Pozovi API poslužitelja za čišćenje lokalne datoteke chata
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

    // 3. Očisti lokalni predmemorijski spremnik
    saveLocalChatCache([]);
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
