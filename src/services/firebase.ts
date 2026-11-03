import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

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

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');

// Validacija veze s Firestore poslužiteljem prema standardu
export async function validateFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore klijent je u offline načinu rada:', error);
      return false;
    }
    // Ostale greške poput missing document nisu greške u povezivanju
    return true;
  }
}

validateFirestoreConnection().catch(() => {});
