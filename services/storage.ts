
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
import { Khatma, FeaturedParticipant } from '../types';

const COLLECTION_NAME = 'khatmas';
const FEATURED_COLLECTION_NAME = 'featured_participants';
const LOCAL_FEATURED_KEY = 'khatma_featured_participants_v1';

// Local listeners for instant UI feedback & fallback
const localFeaturedListeners = new Set<(participants: FeaturedParticipant[]) => void>();

const getLocalFeatured = (): FeaturedParticipant[] => {
  try {
    const raw = localStorage.getItem(LOCAL_FEATURED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveLocalFeatured = (list: FeaturedParticipant[]) => {
  try {
    localStorage.setItem(LOCAL_FEATURED_KEY, JSON.stringify(list));
  } catch {
    // ignore storage quota errors
  }
  localFeaturedListeners.forEach(cb => cb(list));
};

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

export const subscribeToFeaturedParticipants = (
  callback: (participants: FeaturedParticipant[]) => void
) => {
  // Emit local cached data immediately
  const initialLocal = getLocalFeatured();
  callback(initialLocal);

  let firestoreActive = false;

  const localListener = (list: FeaturedParticipant[]) => {
    if (!firestoreActive) {
      callback(list);
    }
  };
  localFeaturedListeners.add(localListener);

  const q = query(collection(db, FEATURED_COLLECTION_NAME), orderBy('createdAt', 'asc'));
  const unsubFirestore = onSnapshot(
    q,
    (snapshot) => {
      firestoreActive = true;
      const remoteList = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      } as FeaturedParticipant));

      // Merge any local-only items with remote list by normalized name
      const localList = getLocalFeatured();
      const mergedMap = new Map<string, FeaturedParticipant>();
      remoteList.forEach(item => {
        mergedMap.set(item.name.trim(), item);
      });
      localList.forEach(item => {
        const key = item.name.trim();
        if (!mergedMap.has(key)) {
          mergedMap.set(key, item);
        }
      });

      const merged = Array.from(mergedMap.values()).sort((a, b) => a.createdAt - b.createdAt);
      try {
        localStorage.setItem(LOCAL_FEATURED_KEY, JSON.stringify(merged));
      } catch {
        // ignore
      }
      callback(merged);
    },
    () => {
      // Fallback to localStorage if Firestore collection isn't accessible
      firestoreActive = false;
      callback(getLocalFeatured());
    }
  );

  return () => {
    localFeaturedListeners.delete(localListener);
    unsubFirestore();
  };
};

export const addFeaturedParticipant = async (participant: FeaturedParticipant) => {
  const cleanName = participant.name.trim();
  if (!cleanName) return;

  const current = getLocalFeatured();
  if (!current.some(p => p.name.trim() === cleanName)) {
    const updated = [...current, { ...participant, name: cleanName }];
    saveLocalFeatured(updated);
  }

  try {
    const docRef = doc(db, FEATURED_COLLECTION_NAME, participant.id);
    await setDoc(docRef, { ...participant, name: cleanName });
  } catch (err) {
    console.warn('Saved featured participant locally (Firestore fallback):', err);
  }
};

export const removeFeaturedParticipant = async (id: string, name?: string) => {
  const current = getLocalFeatured();
  const updated = current.filter(
    p => p.id !== id && (!name || p.name.trim() !== name.trim())
  );
  saveLocalFeatured(updated);

  try {
    const docRef = doc(db, FEATURED_COLLECTION_NAME, id);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn('Removed featured participant locally (Firestore fallback):', err);
  }
};

