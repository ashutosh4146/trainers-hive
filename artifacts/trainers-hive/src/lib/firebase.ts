import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  signOut as firebaseSignOut,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  signInWithPopup,
  signInWithCustomToken,
  GoogleAuthProvider,
  type Auth,
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

const firebaseReady = Boolean(
  import.meta.env.VITE_FIREBASE_API_KEY &&
  import.meta.env.VITE_FIREBASE_APP_ID,
);

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;

if (firebaseReady) {
  try {
    _app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]!;
    _auth = getAuth(_app);
  } catch (e) {
    console.warn("[Firebase] Init failed — auth features disabled:", e);
  }
}

export const auth = _auth as Auth;

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
  if (!_auth) throw new Error("Firebase not configured");
  const callbackUrl = `${window.location.origin}/auth/callback`;
  await sendSignInLinkToEmail(_auth, email, {
    url: callbackUrl,
    handleCodeInApp: true,
  });
}

export function isEmailLinkCallback(url: string = window.location.href): boolean {
  if (!_auth) return false;
  return isSignInWithEmailLink(_auth, url);
}

export async function completeEmailLinkSignIn(email: string, url: string = window.location.href): Promise<User> {
  if (!_auth) throw new Error("Firebase not configured");
  const cred = await signInWithEmailLink(_auth, email, url);
  return cred.user;
}

export async function signInWithGoogle(): Promise<User> {
  if (!_auth) throw new Error("Firebase not configured");
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const cred = await signInWithPopup(_auth, provider);
  return cred.user;
}

export async function signOutFirebase(): Promise<void> {
  if (!_auth) return;
  await firebaseSignOut(_auth);
}

export async function signInWithAdminToken(customToken: string): Promise<User> {
  if (!_auth) throw new Error("Firebase not configured");
  const cred = await signInWithCustomToken(_auth, customToken);
  return cred.user;
}

export function getCurrentFirebaseUser(): User | null {
  return _auth?.currentUser ?? null;
}
