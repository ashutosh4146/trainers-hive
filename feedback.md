# Trainers Hive — Feedback & Improvement Log

## Performance Optimization — May 2026

### Problem
Lighthouse performance score was averaging **~40/100**.

### Root Causes Identified

#### 1. nginx gzip disabled for JS/CSS
`gzip on` was set in `nginx.conf` but the `gzip_types` directive (which enables compression for JS, CSS, fonts, etc.) was commented out. Every JavaScript and CSS file was being served **uncompressed** over the wire — roughly 3× larger than necessary.

#### 2. No browser caching on static assets
No `Cache-Control` or `Expires` headers were set for static files. The browser re-downloaded every JS/CSS file on every page visit, even when nothing had changed.

#### 3. Monolithic JavaScript bundles
Vite was producing two huge unsplit bundles:
- `index.js` — **432 KB**
- `Dashboard.js` — **444 KB** (contained recharts + all admin components)

All vendor libraries (React, Recharts, Framer Motion, Firebase, Zod, TanStack Query) were packed together with application code, preventing granular caching and delaying the initial parse.

---

### Fixes Applied

#### Vite — Manual Chunk Splitting (`vite.config.ts`)
Split vendor libraries into separate cacheable chunks via `rollupOptions.manualChunks`:

| Chunk | Size (gzip) |
|---|---|
| `vendor-react` | React + ReactDOM |
| `vendor-query` | TanStack Query — 40 KB (gzip 12 KB) |
| `vendor-motion` | Framer Motion — 122 KB (gzip 40 KB) |
| `vendor-charts` | Recharts — 407 KB (gzip 110 KB) — **lazy, only loads on Dashboard** |
| `vendor-firebase` | Firebase — 104 KB (gzip 31 KB) |
| `vendor-form` | React Hook Form + Zod — 82 KB (gzip 23 KB) |
| `vendor-router` | Wouter — 13 KB (gzip 5 KB) |

**Result:**
- `Dashboard.js`: 444 KB → **41 KB** (90% reduction)
- `index.js`: 432 KB → **285 KB** (34% reduction)
- Recharts now only loads when a user navigates to the Dashboard page

Also set `build.target: "es2020"` for slightly smaller output on modern browsers.

#### nginx — Gzip + Cache Headers (`/etc/nginx/sites-enabled/trainershive`)
```nginx
# Gzip enabled for all text-based assets
gzip on;
gzip_vary on;
gzip_comp_level 6;
gzip_types text/plain text/css text/javascript application/javascript
           application/json font/woff font/woff2 image/svg+xml;

# Hashed assets cached for 1 year (immutable)
location ~* /assets/.*\.(js|css|woff2?|ttf|svg|png|jpg|ico)$ {
    expires 1y;
    add_header Cache-Control "public, max-age=31536000, immutable";
}

# index.html never cached (SPA routing)
location = /index.html {
    add_header Cache-Control "no-store, no-cache, must-revalidate";
}
```

---

### Actual Results (PageSpeed Insights — Desktop, May 1 2026)

**URL tested:** `http://13.234.17.80/trainers`

| Category | Score |
|---|---|
| Performance | **92 / 100** |
| Accessibility | 86 / 100 |
| Best Practices | 78 / 100 |
| SEO | 83 / 100 |

**Core Web Vitals:**

| Metric | Value | Status |
|---|---|---|
| First Contentful Paint (FCP) | 0.8 s | Good |
| Largest Contentful Paint (LCP) | 1.1 s | Good |
| Total Blocking Time (TBT) | 0 ms | Good |
| Cumulative Layout Shift (CLS) | 0.078 | Good |

**Before → After summary:**

| Metric | Before | After |
|---|---|---|
| Lighthouse Performance | ~40 | **92** |
| JS transferred (first load) | ~1.4 MB uncompressed | ~330 KB gzipped |
| JS transferred (repeat visit) | ~1.4 MB (no cache) | ~0 KB (immutable cache) |

---

### Further Improvement Possible
- Add **Cloudflare** (free tier) as CDN in front of EC2 to reduce geographic latency and get edge caching + HTTP/2 push
- Replace `pdfjs-dist` (444 KB) with server-side PDF-to-text extraction to eliminate it from the frontend bundle entirely
- Accessibility score (86): add `aria-label` attributes to icon-only buttons and improve colour contrast on muted text
- SEO score (83): add `<meta description>` tags per page and structured data (JSON-LD)
