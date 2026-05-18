This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Native Mobile Apps (Capacitor)

CoachFlow is packaged for iOS and Android with Capacitor using the hosted PWA as
the WebView source.

App configuration:

- Name: `CoachFlow`
- Bundle ID / App ID: `com.coachflow.app`
- Web source: `https://coachflow.website` by default
- Override web source for testing with `CAPACITOR_SERVER_URL`

Useful commands:

```bash
# Build the Next.js app
npm run build

# Sync Capacitor config/assets into native projects
npm run cap:sync

# Open native projects
npm run cap:ios
npm run cap:android

# Regenerate app icons and splash screens from assets/icon.png and assets/splash.png
npm run cap:assets
```

Native projects:

- iOS: `ios/`
- Android: `android/`

Branding assets:

- Source logo: `public/logo.png`
- Native asset source files: `assets/icon.png` and `assets/splash.png`
- Generated icons and splash screens are committed into the iOS and Android
  project folders.

Authentication and Stripe:

- The Capacitor WebView loads the deployed CoachFlow PWA, so Supabase auth,
  `/auth/callback`, and Stripe Checkout/Billing Portal continue to use the same
  server-backed routes as the web app.
- `capacitor.config.ts` allows navigation to CoachFlow, Supabase, and Stripe
  domains.

Android requirements:

- Install a JDK and Android Studio before opening/syncing Android. If `cap add`
  reports a Gradle/JDK warning, open `android/` in Android Studio and let it
  sync once Java/SDK tooling is installed.
