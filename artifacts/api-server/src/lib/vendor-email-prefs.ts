export const DEFAULT_VENDOR_EMAIL_PREFS = {
  newApplication: true,
  trainerWithdrew: true,
  messages: true,
};

export type VendorEmailPrefs = {
  newApplication: boolean;
  trainerWithdrew: boolean;
  messages: boolean;
};

export function resolveVendorEmailPrefs(stored: unknown): VendorEmailPrefs {
  return { ...DEFAULT_VENDOR_EMAIL_PREFS, ...((stored as Partial<VendorEmailPrefs>) ?? {}) };
}
