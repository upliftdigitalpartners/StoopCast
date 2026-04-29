# StoopCast

Real-time alerts for free stuff on stoops in your neighborhood. Photo-tag a couch, lamp, or box of books on the curb, drop a pin, and nearby users get a 15-minute window notification before it gets claimed or rained on. Built-in karma score for posters.

Mobile native app — Expo (React Native) + Supabase (Postgres + PostGIS + Auth + Storage + Edge Functions + Realtime).

---

## Stack

- **App**: Expo SDK 51, TypeScript, expo-router (file-based)
- **Maps**: react-native-maps
- **Auth/DB/Storage/Realtime**: Supabase
- **Push**: Expo Push Notifications, fanned out from a Supabase Edge Function
- **Geo**: PostGIS (`geography(point, 4326)`) with a `nearby_posts(lat, lng, radius_m)` RPC

## Project layout

```
app/                       expo-router screens
  _layout.tsx              root + auth gate
  (auth)/sign-in.tsx
  (tabs)/index.tsx         map of nearby live posts
  (tabs)/post.tsx          create a post (camera + geo)
  (tabs)/profile.tsx       your karma + your posts
  post/[id].tsx            post detail + claim
lib/
  supabase.ts              client (uses EXPO_PUBLIC_* env)
  auth.tsx                 AuthProvider + useAuth
  notifications.ts         push registration
  theme.ts time.ts types.ts
supabase/
  migrations/0001_init.sql      schema, RLS, triggers, RPCs, storage bucket
  migrations/0002_recipients_rpc.sql
  functions/notify-nearby/index.ts   edge fn called on post INSERT webhook
```

## One-time setup

### 1. Install deps

```bash
npm install
```

### 2. Create a Supabase project

- Get `Project URL` and `anon` key from Project Settings → API.
- Get the `service_role` key (used only by the edge function — never ship it in the app).

### 3. Wire the env

```bash
cp .env.example .env
# fill EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY
```

### 4. Apply the schema

In the Supabase SQL editor, run the contents of:
- `supabase/migrations/0001_init.sql`
- `supabase/migrations/0002_recipients_rpc.sql`

This creates `profiles`, `posts`, `claims`, `push_tokens`, the `stoop-photos` storage bucket, RLS policies, and the `nearby_posts` / `create_post` / `recipients_near` RPCs.

### 5. Deploy the push edge function

```bash
# Install the Supabase CLI if you haven't (https://supabase.com/docs/guides/cli)
supabase link --project-ref <your-project-ref>
supabase functions deploy notify-nearby --no-verify-jwt
```

Then in the Supabase dashboard:
- **Database → Webhooks → Create a new hook**
- Table: `posts`, Events: `INSERT`
- Type: **Supabase Edge Functions**, choose `notify-nearby`

### 6. (Optional) Schedule expiry sweep

In **Database → Cron**, schedule `select public.expire_old_posts();` every minute so expired posts disappear from the feed.

## Run the app

```bash
npm run start
# then press i for iOS simulator, a for Android, or scan the QR with Expo Go
```

Push notifications and `react-native-maps` require a real device or a dev-client build, not the Expo Go app's web preview.

## Build an Android APK with EAS (free)

1. Get a Google Maps API key (Google Cloud Console → enable **Maps SDK for Android**) and paste it into `app.json` under `android.config.googleMaps.apiKey`.
2. Sign up for a free Expo account if you don't have one: <https://expo.dev/signup>.
3. Install the EAS CLI and log in:
   ```bash
   npm install -g eas-cli
   eas login
   eas init   # links the repo to a new Expo project (creates an EAS project ID)
   ```
4. Build an installable APK on EAS's free queue:
   ```bash
   eas build -p android --profile preview
   ```
   When the build finishes (~10–30 min on the free queue) EAS prints a download URL; install the APK on any Android phone with USB or "Install from unknown sources" enabled.

For a Play Store-ready AAB later: `eas build -p android --profile production`.

## Notes & next steps

- `recipients_near` is intentionally simple in the MVP: it returns all push tokens. Replace it with a proper "user neighborhood center" join once users can set a home base.
- The 15-minute window lives on `posts.expires_at`; the UI counts down and the cron sweep flips them to `expired`.
- Karma is `+1` to the poster on each successful claim (see `claims_on_insert` trigger in `0001_init.sql`). Add abuse protection (rate limits, "report this post") before scaling.
- For a production build use EAS: `eas build --profile production --platform ios` (and android).
