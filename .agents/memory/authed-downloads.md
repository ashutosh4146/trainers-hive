---
name: Authenticated file downloads
description: Why download buttons to token-protected API endpoints must use fetch+blob, not anchor/window.open
---

# Authenticated file downloads

When an API endpoint requires `Authorization: Bearer <token>` (this app's `getActiveUserId` only accepts a bearer token — Firebase ID token or app JWT — and in production has no cookie/session fallback, so it throws 401), a download triggered by a plain `<a href={url} target="_blank">` or `window.open(url)` will fail with 401.

**Why:** A direct browser navigation does not carry the JS-managed Authorization header (the app stores its token in `localStorage` under `th_session_token` and injects it via a fetch interceptor). Browser navigations bypass that interceptor entirely. Telltale signs in logs: the request has an empty `Referer` and is immediately followed by a `/favicon.ico` hit (browser treated the response as a page).

**How to apply:** Download protected files with `fetch(url, { headers: { Authorization: 'Bearer ' + localStorage.getItem('th_session_token') } })`, then `res.blob()` → `URL.createObjectURL` → temporary `<a download>` click → `revokeObjectURL`. Reuse this pattern for any new protected download button. Do NOT rely on `auth.currentUser?.getIdToken()` — it returns null for password-login users; read the localStorage token instead.
