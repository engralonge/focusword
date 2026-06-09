# Citizens Bible Community

Bible study live streaming app built with **React Native**, **Expo**, **NativeWind**, and **Supabase**.

## Features

- Bottom tab navigation: Live, Bible, Prayer, Community, Profile
- Complete World English Bible bundled for offline reading and search
- Provider-backed NIV/ESV/KJV access when licensed, with notes, highlights, bookmarks, and AI summaries
- NativeWind (Tailwind) styling with light / dark / system theme
- Supabase email auth with verification and password recovery
- Owned community posts, comments, reactions, prayer requests, and prayer support
- LiveKit-powered native study rooms with host camera/microphone controls and persistent chat
- Scheduled studies with local reminders and notification deep links
- Moderator-ready row-level security policies
- EAS development, preview, and production build profiles

## Quick start

```bash
cd bible-study-platform
npm install
cp .env.example .env
# Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY
npm run start:dev-client
```

Live video uses native WebRTC modules and does not run in Expo Go. Install an EAS
development build, then start Metro with `npm run start:dev-client`. The web build supports
the rest of the platform and directs live-video participants to the native app.

## Project structure

```
src/
├── navigation/     # Root, tabs, and stack navigators
├── screens/        # Feature screens per tab
├── components/     # UI, live, and common components
├── services/       # Supabase, auth, streaming, bible, community
├── context/        # Theme and auth providers
├── hooks/          # (extend as needed)
├── constants/      # Config and palette
├── types/          # Shared TypeScript types
└── utils/          # Storage, cn helper
```

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com)
2. Copy URL and anon key into `.env`
3. Apply all files in `supabase/migrations` in numeric order
4. Add `focusword://auth/callback` and `focusword://auth/reset-password` to the Auth redirect URLs
5. Enable Email auth and require email verification in Authentication settings

## AI summaries

AI requests are handled by the authenticated `summarize-passage` Supabase Edge Function.
Never place an AI provider key in an `EXPO_PUBLIC_` variable. Configure the server secret instead:

```bash
supabase secrets set XAI_API_KEY=... XAI_MODEL=grok-4.3
supabase functions deploy summarize-passage
```

## Bible content

Full-canon content is proxied through the authenticated `bible-content` Edge Function so
API.Bible credentials never enter the mobile bundle. Translation availability depends on
your API.Bible plan and license:

```bash
supabase secrets set API_BIBLE_KEY=...
supabase secrets set API_BIBLE_KJV_ID=... API_BIBLE_NIV_ID=... API_BIBLE_ESV_ID=...
supabase functions deploy bible-content
```

The complete public-domain World English Bible is bundled in the app for offline reading
and search. Provider-backed translations display their required copyright notices. Notes,
highlights, bookmarks, and reading progress sync through Supabase.

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start Expo dev server |
| `npm run android` | Open on Android |
| `npm run ios` | Open on iOS (macOS required for native build) |
| `npm run web` | Run in browser |
| `npm run typecheck` | Run strict TypeScript checks |
| `npm test` | Run Jest tests |
| `npm run test:ci` | Run tests with coverage |
| `npm run check` | Run the local quality gate |
| `npm run build:production` | Build Android and iOS with EAS |

## Bible reader

The complete **World English Bible** is available offline. With API.Bible configured, users
can also access licensed translations. All translations support navigation across 66 books,
keyword/reference search, synced study annotations, and secure AI summaries through Supabase.

## Live studies

Create a LiveKit Cloud project (or deploy LiveKit yourself), then configure and deploy the
authenticated token function:

```bash
supabase secrets set LIVEKIT_URL=wss://your-project.livekit.cloud
supabase secrets set LIVEKIT_API_KEY=... LIVEKIT_API_SECRET=...
supabase functions deploy livekit-token livekit-webhook delete-account
```

Apply `supabase/migrations/005_live_study_platform.sql` before enabling the feature. Hosts
can schedule, start, and end rooms; attendees receive subscribe-only room tokens. Chat is
stored in Supabase with row-level security. Reminder notifications are scheduled locally
on each attendee's device. In LiveKit Cloud, configure the signed webhook URL as
`https://YOUR_PROJECT.supabase.co/functions/v1/livekit-webhook` so participant counts stay
synchronized.

Apply `supabase/migrations/006_operations_and_safety.sql` to enable provider request quotas
and authenticated client error reporting.

Production EAS environments must also define HTTPS values for
`EXPO_PUBLIC_PRIVACY_POLICY_URL`, `EXPO_PUBLIC_TERMS_URL`, and
`EXPO_PUBLIC_SUPPORT_URL`. The app blocks a production configuration when these are absent.

## Remaining external setup

- Configure API.Bible translation access and server secrets.
- Configure LiveKit server secrets and deploy the token function.
- Add store credentials and EAS project ownership before production submission.
