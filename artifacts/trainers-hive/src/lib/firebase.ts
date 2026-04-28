import { initializeApp, getApps } from "firebase/app";
import { getAuth, signInWithCustomToken, signOut as firebaseSignOut, type User } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "trainershive-b2995.firebaseapp.com",
  projectId: "trainershive-b2995",
  storageBucket: "trainershive-b2995.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]!;
export const auth = getAuth(app);

export async function signInWithToken(customToken: string): Promise<User> {
  const cred = await signInWithCustomToken(auth, customToken);
  return cred.user;
}

export async function signOutFirebase(): Promise<void> {
  await firebaseSignOut(auth);
}

export function getCurrentFirebaseUser(): User | null {
  return auth.currentUser;
}
