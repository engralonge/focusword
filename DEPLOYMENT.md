# Citizens Bible Community Production Deployment

## 1. Supabase

1. Link the production project with the Supabase CLI.
2. Apply all migrations in `supabase/migrations` in numeric order.
3. Enable email verification.
4. Add these Auth redirect URLs:
   - `focusword://auth/callback`
   - `focusword://auth/reset-password`
5. Set server-only secrets:

```bash
supabase secrets set \
  XAI_API_KEY=... \
  XAI_MODEL=grok-4.3 \
  API_BIBLE_KEY=... \
  API_BIBLE_KJV_ID=... \
  API_BIBLE_NIV_ID=... \
  API_BIBLE_ESV_ID=... \
  LIVEKIT_URL=wss://YOUR_PROJECT.livekit.cloud \
  LIVEKIT_API_KEY=... \
  LIVEKIT_API_SECRET=...
```

6. Deploy the functions:

```bash
supabase functions deploy summarize-passage
supabase functions deploy bible-content
supabase functions deploy livekit-token
supabase functions deploy livekit-stage
supabase functions deploy livekit-webhook --no-verify-jwt
supabase functions deploy delete-account
```

## 2. LiveKit

Create a signed webhook in LiveKit Cloud:

```text
https://YOUR_SUPABASE_PROJECT.supabase.co/functions/v1/livekit-webhook
```

Use the same API key configured in the Supabase function secrets. Send test
`participant_joined` and `participant_left` events and confirm `viewer_count` changes in
`public.live_streams`.

## 3. EAS Environments

Set these variables for development, preview, and production as appropriate:

```text
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
EXPO_PUBLIC_ENVIRONMENT
EXPO_PUBLIC_PRIVACY_POLICY_URL
EXPO_PUBLIC_TERMS_URL
EXPO_PUBLIC_SUPPORT_URL
```

Production policy URLs must be real HTTPS URLs. Placeholder `example.com` values are
rejected by the app.

Initialize the EAS project, add the generated project ID to `app.json`, and configure App
Store Connect and Google Play credentials.

## 4. Verification

```bash
npm ci
npm run check
npx expo-doctor
eas build --platform android --profile preview
eas build --platform ios --profile preview
```

On physical iOS and Android devices, verify:

- sign-up, email verification, password reset, sign-out, and account deletion;
- Bible browsing, provider copyright, search, notes, highlights, bookmarks, and summaries;
- community posts, comments, reactions, prayers, and moderation policies;
- prayer progress updates, answered testimonies, anonymity, and timeline ownership policies;
- Focus Mode consent, foreground-only time credit, interruption tracking, session recovery,
  and Android/iOS system-settings links;
- community point awards, daily caps, streak calculations, immutable ledger behavior,
  and clear non-monetary/non-transferable disclosures;
- persistent session restoration, Activity Center events, avatar upload and replacement,
  pinned live video, participant leave controls, and multi-camera rendering;
- opt-in replay consent, LiveKit Egress start/stop behavior, recording completion webhooks,
  and playback availability when S3-compatible recording storage is configured;
- host and attendee LiveKit connections, moderated guest camera/microphone permissions,
  consent-based host invitations, speaking queue, individual and mute-all controls,
  synchronized live Scripture, translation changes, verse focus, shared AI insight,
  chat, reminders, deep links, participant counts, and room completion;
- brief Wi-Fi/mobile-data interruptions recover without leaving the live screen, a failed
  recovery presents the Rejoin action, and returning after five minutes in the background
  refreshes room credentials;
- ending a study removes every attendee within ten seconds even if realtime delivery is
  delayed, and retrying the host end action remains successful;
- LiveKit token/stage logs include `requestId`, `streamId`, action, and outcome fields, while
  repeated client errors are deduplicated in `public.app_error_events`;
- dark/light themes, offline fallback passages, screen-reader labels, and small screens.

Local Android compilation additionally requires a JDK and Android SDK. When those are not
installed, use EAS preview builds as the authoritative native compiler.

## 5. Release

After preview acceptance:

```bash
eas build --platform all --profile production
eas submit --platform all --profile production
```

The project requires a development or production build for LiveKit. Expo Go is not
supported for live video.
