# iOS build (Capacitor) — Phase 1A

## Overview

[Capacitor](https://capacitorjs.com/) wraps the existing React/Vite web app in a
native iOS shell. It produces a real Xcode project under `ios/` whose single
screen is a full-screen `WKWebView` that loads the production web build copied
into `ios/App/App/public`. The same `dist/` bundle that ships to the web is the
bundle that runs on-device, so there is no second codebase — Capacitor only adds
the native container plus a JS bridge we will use in later phases to reach native
APIs (camera, push, etc.).

This project uses **Capacitor 8**, which manages native dependencies with
**Swift Package Manager (SPM)**, not CocoaPods. There is no `Podfile` and you do
**not** need to run `pod install` — Xcode resolves the Swift packages
(`ios/App/CapApp-SPM/Package.swift`) automatically when you open the project.

## First-time setup

To open and build the project you need:

- **Xcode** — the full app from the Mac App Store, *not* just the Command Line
  Tools. (This build machine currently has only the Command Line Tools, so the
  project can be scaffolded and synced but cannot be opened/built here yet.)
- After installing Xcode, point the toolchain at it and accept the license:
  ```sh
  sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
  sudo xcodebuild -license accept
  ```
- An iOS Simulator runtime (Xcode → Settings → Components).

No CocoaPods install is required. The web-side toolchain (`@capacitor/cli`,
`@capacitor/core`, `@capacitor/ios`, plus `typescript` so the CLI can read
`capacitor.config.ts`) is already in `package.json`.

## Build workflow

Two scripts cover the loop, plus a convenience combo:

- **`npm run ios:sync`** — runs `npm run build` (regenerates `dist/`) then
  `npx cap sync ios`, which copies the fresh web build into the native project
  and updates the Swift package list. Run this whenever the web app changes.
  This step needs neither Xcode nor CocoaPods, so it runs on any machine.
- **`npm run ios:open`** — opens the native iOS project in Xcode (requires full
  Xcode) so you can pick a Simulator and hit Run. This does *not* rebuild web
  assets.
- **`npm run ios:dev`** — `ios:sync` followed by `ios:open`; the one-shot command
  for "rebuild everything and open Xcode."

### API base URL

The production web build reads `import.meta.env.VITE_API_URL`. Because the native
WebView has no dev proxy, `.env.production` sets it to the absolute backend URL
(`https://intellix-production.up.railway.app`). Local `npm run dev` leaves it
unset and falls back to relative `/api` URLs, which Vite proxies to
`localhost:3001`. (Note: the original spec referenced `VITE_API_BASE_URL`, but
the codebase actually reads `VITE_API_URL` — see `src/lib/api.js` and the
per-page fetch helpers — so that is the variable name used here.)

## Known scope (Phase 1A)

This phase is a **bare wrap only**: the app loads the web build in a WebView with
no native plugin integration. `capacitor.config.ts` intentionally has an empty
`plugins` block. Future work adds native capability:

- **Phase 1B** — per-plugin integration (e.g. camera, push notifications, status
  bar, splash screen, secure storage) with their config under `plugins`.

The PWA service worker registered in `src/main.jsx` is left as-is for now; if it
causes stale-asset caching inside the WebView, revisit it in a later phase.

## Distribution

Current state is **free provisioning only** — you can build and run on the
Simulator and on a personally-registered device via your free Apple ID. There is
no signing identity, provisioning profile, App Store Connect app, or TestFlight
pipeline configured yet. Paid Apple Developer Program enrollment and signing
setup are out of scope for Phase 1A.
