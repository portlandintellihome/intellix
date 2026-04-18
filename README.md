# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## PWA install notes

Intellix is installable as a PWA via the browser's "Add to Home Screen" option.

**iOS caches the installed PWA aggressively.** If you update the app shell (manifest, service worker, theme color, status bar style, icons) and the home-screen install still shows the old styling — for example a grey status bar instead of the theme color — iOS is serving a stale cached copy.

To refresh it:
1. Long-press the Intellix icon on the home screen.
2. Tap **Remove App → Delete App**.
3. Open the site in Safari again.
4. Share → **Add to Home Screen** to reinstall.

The freshly installed version will pick up the current manifest and the new status-bar / theme-color behavior.
