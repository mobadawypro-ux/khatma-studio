
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { db } from './firebase';
import { Khatma } from '../types';

const COLLECTION_NAME = 'khatmas';

export const subscribeToKhatmas = (callback: (khatmas: Khatma[]) => void) => {
  const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const khatmas = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Khatma));
    callback(khatmas);
  });
};

export const addKhatma = async (khatma: Khatma) => {
  const docRef = doc(db, COLLECTION_NAME, khatma.id);
  // We use setDoc here because we already generated a client-side ID
  await setDoc(docRef, { ...khatma });
};

export const updateKhatmaRemote = async (khatma: Khatma) => {
  const docRef = doc(db, COLLECTION_NAME, khatma.id);
  // Extract ID to avoid saving it as a field inside the document
  const { id, ...data } = khatma;
  await updateDoc(docRef, data);
};

export const deleteKhatmaRemote = async (id: string) => {
  const docRef = doc(db, COLLECTION_NAME, id);
  await deleteDoc(docRef);
};
