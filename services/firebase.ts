
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyB5V1d2KNZExe8jsxU3dd3an6rZUI6mE64",
  authDomain: "khatma-9cbdf.firebaseapp.com",
  projectId: "khatma-9cbdf",
  storageBucket: "khatma-9cbdf.firebasestorage.app",
  messagingSenderId: "824948942426",
  appId: "1:824948942426:web:b04b8acbc83885130b5a63"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
