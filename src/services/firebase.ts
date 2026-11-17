import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  initializeFirestore,
  setLogLevel,
  doc,
  getDocFromServer,
  enableNetwork,
  disableNetwork
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Isključi interne @firebase/firestore poruke o zatvaranju neaktivnih (idle) streamova
setLogLevel('silent');

const app = getApps().length === 0
  ? initializeApp({
      projectId: firebaseConfig.projectId,
      appId: firebaseConfig.appId,
      apiKey: firebaseConfig.apiKey,
      authDomain: firebaseConfig.authDomain,
      storageBucket: firebaseConfig.storageBucket,
      messagingSenderId: firebaseConfig.messagingSenderId
    })
  : getApp();

const dbId = firebaseConfig.firestoreDatabaseId || '(default)';

let firestoreInstance;
try {
  firestoreInstance = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true
  }, dbId);
} catch {
  firestoreInstance = getFirestore(app, dbId);
}

export const db = firestoreInstance;

let isFirestoreNetworkEnabled = true;
let backgroundSuspendTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Upravlja mrežnom vezom Firestorea:
 * - Dok je aplikacija u pozadini ili je zaslon ugašen (document.hidden === true),
 *   gasi WebChannel / HTTP Long-Polling vezu (0% potrošnje baterije i procesora u pozadini!).
 * - Čim se aplikacija otvori ili zaslon uključi, trenutno ponovno uključuje mrežu.
 */
export function setFirestoreNetworkActive(active: boolean): void {
  if (backgroundSuspendTimer) {
    clearTimeout(backgroundSuspendTimer);
    backgroundSuspendTimer = null;
  }

  if (active) {
    if (!isFirestoreNetworkEnabled) {
      isFirestoreNetworkEnabled = true;
      enableNetwork(db).catch(() => {});
    }
  } else {
    // Kratka odgoda od 1.5s prije gašenja mreže u pozadini kako brza promjena fokusa ne bi prekidala upite
    backgroundSuspendTimer = setTimeout(() => {
      if (typeof document !== 'undefined' && document.hidden && isFirestoreNetworkEnabled) {
        isFirestoreNetworkEnabled = false;
        disableNetwork(db).catch(() => {});
      }
    }, 1500);
  }
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const handleVisibilityChange = () => {
    if (document.hidden) {
      setFirestoreNetworkActive(false);
    } else {
      setFirestoreNetworkActive(true);
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('focus', () => setFirestoreNetworkActive(true));
  window.addEventListener('pageshow', () => setFirestoreNetworkActive(true));
  window.addEventListener('pagehide', () => setFirestoreNetworkActive(false));
}

// Validacija veze s Firestore poslužiteljem prema standardu
export async function validateFirestoreConnection(): Promise<boolean> {
  if (typeof document !== 'undefined' && document.hidden) return true;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      return false;
    }
    return true;
  }
}

