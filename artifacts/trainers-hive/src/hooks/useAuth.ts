import React from "react";

const AUTH_KEY = "th_auth";

export type UserRole = "trainer" | "vendor" | "college";

export interface AuthState {
  signedIn: boolean;
  name: string;
  email: string;
  role: UserRole;
  orgName?: string;
}

function getStoredAuth(): AuthState | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthState;
  } catch {
    return null;
  }
}

export function clearAuthState() {
  localStorage.removeItem(AUTH_KEY);
}

export function saveAuthState(state: AuthState) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(state));
}

export function useAuth() {
  const [auth, setAuth] = React.useState<AuthState | null>(getStoredAuth);

  const signIn = React.useCallback((state: AuthState) => {
    saveAuthState(state);
    setAuth(state);
  }, []);

  const signOut = React.useCallback(() => {
    clearAuthState();
    setAuth(null);
  }, []);

  return { auth, signIn, signOut, isSignedIn: !!auth };
}

const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.in", "yahoo.co.uk",
  "hotmail.com", "hotmail.co.uk", "hotmail.in", "outlook.com", "outlook.in",
  "live.com", "live.in", "aol.com", "icloud.com", "me.com", "mac.com",
  "protonmail.com", "proton.me", "pm.me", "tutanota.com", "tutamail.com",
  "zoho.com", "yandex.com", "yandex.ru", "mail.com", "inbox.com",
  "gmx.com", "gmx.de", "rediffmail.com", "msn.com",
]);

export function isBusinessEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return false;
  return !FREE_EMAIL_DOMAINS.has(domain);
}

export function roleRequiresBusinessEmail(role: UserRole): boolean {
  return role === "vendor" || role === "college";
}

export function getRoleSessionKey(role: UserRole): "vendor" | "trainer" | "admin" {
  if (role === "college") return "vendor";
  return role;
}

export function getRoleLabel(role: UserRole): string {
  switch (role) {
    case "trainer": return "Trainer";
    case "vendor": return "Vendor";
    case "college": return "College / Company";
  }
}
