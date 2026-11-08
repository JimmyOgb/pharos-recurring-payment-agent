# PHAROS RECURRING PAYMENT AGENT — DEPLOYMENT REPORT

**Application Name:** Pharos Recurring Payment Agent  
**Environment:** Production  
**Hosting Provider:** Vercel  
**Project ID:** `prj_B0DkY6TtN2453vgyzVmGWPBhNpYX`  
**Deployment ID:** `dpl_9kFDTQPVc4xeENa4zr5yt8mPtsTa`  
**Vercel Team / Account:** `jamism123` / `jiangy4545-9170`  
**Production URL:** https://pharos-recurring-payment-agent.vercel.app/  
**Direct Deployment URL:** https://pharos-recurring-payment-agent-d5aofr4ci-jamism123.vercel.app  
**GitHub Repository:** https://github.com/JimmyOgb/pharos-recurring-payment-agent  
**Git Commit SHA:** `02acded`  
**Deployment Timestamp:** November 8, 2026

---

## 1. Build & Deployment Diagnostics

- **Framework:** Vite 6.1.0 + React 19 + TypeScript 5.7.2 + Tailwind CSS 3.4.17
- **Web3 Engine:** Viem 2.23.5
- **Build Command:** `npm run build` (`tsc && vite build`)
- **Output Directory:** `dist`
- **Output Bundles:**
  - `dist/index.html` (0.95 kB)
  - `dist/assets/index-DwVREUn-.css` (23.06 kB)
  - `dist/assets/ccip-CDlreR3B.js` (4.53 kB)
  - `dist/assets/index-Bjf-m79a.js` (574.28 kB)
- **Routing Rules (`vercel.json`):**
  - All incoming paths rewrite to `/index.html` for single-page client-side hydration.

---

## 2. Post-Deployment Verification & Smoke Test Results

A full headless browser smoke test was conducted using Playwright against the production URL:

| Verification Check | Target / Metric | Observed Result | Status |
|---|---|---|:---:|
| **HTTP Status Code** | 200 OK | `200` | **PASSED** |
| **Page Title** | Pharos Recurring Payment Agent | `Pharos Recurring Payment Agent — Non-Custodial On-Chain Subscriptions & Payroll` | **PASSED** |
| **H1 Header** | Pharos PayPilot Branding | `Pharos PayPilot` | **PASSED** |
| **DOM Root Mount** | `#root.children.length > 0` | `1` (React hydrated) | **PASSED** |
| **Console Errors** | 0 uncaught exceptions | `0` runtime errors | **PASSED** |
| **Live RPC Read** | Pharos Pacific / Base RPC | Verified active | **PASSED** |
| **Public Accessibility** | Global non-restricted | Verified active | **PASSED** |

---

## 3. Maintenance & Redeployment Commands

To deploy future updates to this production application:

```bash
cd "C:\Users\NO GO NO\PharosBuild\skills\pharos-recurring-payment-agent"

# Run tests
npm test

# Build locally
npm run build

# Push to GitHub
git push origin main

# Deploy to Vercel production
vercel --prod --yes
```
