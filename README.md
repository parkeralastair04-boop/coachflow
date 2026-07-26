# Awarix

Awarix is a premium football intelligence platform helping coaches develop players through AI, insights and smarter coaching.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Product surfaces

- Marketing site and pricing
- Coach dashboard (squads, sessions, registers, AI reports, insights)
- Parent booking portal and family dashboard
- Demo academy workspace at `/demo`
- Native iOS / Android shells via Capacitor

## Native mobile apps (Capacitor)

Awarix is packaged for iOS and Android with Capacitor using the hosted PWA as the WebView source.

App configuration:

- Name: `Awarix`
- Bundle ID / App ID: `com.awarix.app`
- Web source: `https://awarix.co.uk` by default
- Override web source for testing with `CAPACITOR_SERVER_URL`

Useful commands:

```bash
npm run build
npm run cap:sync
npm run cap:ios
npm run cap:android
npm run cap:assets
```

Branding assets:

- Source logo: `public/logo.png`
- Native asset sources: `assets/icon.png` and `assets/splash.png`
- Generated icons and splash screens live in the `ios/` and `android/` projects

## Documentation

See `docs/` for operations, entitlements, billing, demo mode, and launch checklists.
