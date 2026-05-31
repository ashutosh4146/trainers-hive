import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  signOut as firebaseSignOut,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  signInWithPopup,
  signInWithCustomToken,
  GoogleAuthProvider,
  type User,
} from "firebase/auth";

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

const PENDING_AUTH_KEY = "th_pending_auth";

export interface PendingAuth {
  type: "login" | "signup";
  role: string;
  email: string;
  name?: string;
  orgName?: string;
  orgType?: string;
}

export function savePendingAuth(data: PendingAuth): void {
  localStorage.setItem(PENDING_AUTH_KEY, JSON.stringify(data));
}

export function loadPendingAuth(): PendingAuth | null {
  try {
    const raw = localStorage.getItem(PENDING_AUTH_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PendingAuth;
  } catch {
    return null;
  }
}

export function clearPendingAuth(): void {
  localStorage.removeItem(PENDING_AUTH_KEY);
}

export async function sendEmailSignInLink(email: string): Promise<void> {
  const callbackUrl = `${window.location.origin}/auth/callback`;
  await sendSignInLinkToEmail(auth, email, {
    url: callbackUrl,
    handleCodeInApp: true,
  });
}

export function isEmailLinkCallback(url: string = window.location.href): boolean {
  return isSignInWithEmailLink(auth, url);
}

export async function completeEmailLinkSignIn(email: string, url: string = window.location.href): Promise<User> {
  const cred = await signInWithEmailLink(auth, email, url);
  return cred.user;
}

export async function signInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const cred = await signInWithPopup(auth, provider);
  return cred.user;
}

export async function signOutFirebase(): Promise<void> {
  await firebaseSignOut(auth);
}

export async function signInWithAdminToken(customToken: string): Promise<User> {
  const cred = await signInWithCustomToken(auth, customToken);
  return cred.user;
}

export function getCurrentFirebaseUser(): User | null {
  return auth.currentUser;
}
