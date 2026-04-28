import { initializeApp, cert, getApps, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

let app: App;

function getFirebaseApp(): App {
  if (app) return app;
  if (getApps().length > 0) {
    app = getApps()[0]!;
    return app;
  }

  const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccountRaw) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT environment variable is not set");
  }

  const serviceAccount = JSON.parse(serviceAccountRaw);
  app = initializeApp({ credential: cert(serviceAccount) });
  return app;
}

export function getFirebaseAuth() {
  return getAuth(getFirebaseApp());
}

export async function createCustomToken(uid: string, claims?: Record<string, unknown>): Promise<string> {
  const auth = getFirebaseAuth();
  return auth.createCustomToken(uid, claims);
}

export async function verifyIdToken(idToken: string) {
  const auth = getFirebaseAuth();
  return auth.verifyIdToken(idToken);
}
