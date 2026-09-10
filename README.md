# My Life v0.3 — Cloud foundation

This version turns the v0.2 prototype into a real multi-device web app foundation.

## What is implemented

- **Supabase Auth** with email/password sign-in.
- **Cloud tasks** with Row Level Security.
- **Cloud meal tracking**. A meal remains active for 24 hours, so the tracker works across night/day schedules.
- **Cloud weight logging**.
- **Live Google Calendar OAuth** through Netlify Functions.
- **Encrypted Google refresh-token storage** using AES-256-GCM.
- **Live calendar aggregation** across the Google calendars the connected account can read, excluding holiday calendars.
- The **day calendar is still the first/main screen** when the app boots.
- Dynamic **Right Now** and **Upcoming** panels use the live calendar.
- PWA shell so the hosted site can be added to an iPhone home screen.

Your existing site:
`https://animated-raindrop-2d6d48.netlify.app/`

---

# 1. Put the project in GitHub

Unzip this folder and create a GitHub repository from its contents.

Then in Netlify, connect the existing site to that GitHub repository (or create a new Netlify site from the repo).

The repository route is important now because v0.3 uses **Netlify Functions**, not only static HTML.

---

# 2. Create Supabase

Create a Supabase project.

In **SQL Editor**, run:

`supabase/schema.sql`

Then copy these values from Supabase project settings:

- Project URL
- anon/public key
- service-role key

**Never expose the service-role key in browser code.**

---

# 3. Configure Supabase Auth

In Supabase Auth settings:

- Add `https://animated-raindrop-2d6d48.netlify.app` as a Site URL / allowed redirect URL.
- Email/password auth can remain enabled.
- If email confirmation is enabled, confirm the account email before signing in.

---

# 4. Create Google Calendar OAuth credentials

In Google Cloud Console:

1. Create/select a Google Cloud project.
2. Enable **Google Calendar API**.
3. Configure the OAuth consent screen.
4. Create an **OAuth Client ID → Web application**.
5. Add this exact authorized redirect URI:

`https://animated-raindrop-2d6d48.netlify.app/.netlify/functions/google-auth-callback`

If the OAuth app is still in testing mode, add the Google account you will use as a test user.

The app requests **read-only calendar access**.

---

# 5. Add Netlify environment variables

In the Netlify site's environment-variable settings add:

## Browser-safe

```text
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## Server-only

```text
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...

GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://animated-raindrop-2d6d48.netlify.app/.netlify/functions/google-auth-callback

SITE_URL=https://animated-raindrop-2d6d48.netlify.app

STATE_SECRET=...
TOKEN_ENCRYPTION_KEY=...
```

`TOKEN_ENCRYPTION_KEY` must be **exactly 64 hexadecimal characters** (32 random bytes).

You can generate both secrets locally with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Run it twice: once for `STATE_SECRET` and once for `TOKEN_ENCRYPTION_KEY`.

Do **not** put server secrets in any variable beginning with `VITE_`.

---

# 6. Deploy

Netlify reads `netlify.toml` automatically.

The build is:

```text
npm run build
```

and the output directory is:

```text
dist
```

After Netlify deploys:

1. Open the site.
2. Create your My Life account.
3. Sign in.
4. Click **Connect** in the Google Calendar card.
5. Approve read-only calendar access.
6. You will return to My Life and the day calendar will load live events.

---

# 7. iPhone

After the HTTPS deployment works:

Safari → Share → **Add to Home Screen**

The PWA manifest is included.

---

## Security model

- Browser uses only the Supabase **anon key**.
- RLS prevents one signed-in user from reading another user's tasks/meals/weights.
- Google OAuth client secret stays inside Netlify Functions.
- Google refresh tokens are encrypted before they are stored in Supabase.
- The Google Calendar scopes are read-only.

## Next planned layer

After v0.3 is deployed and stable, the next useful additions are:

- settings for choosing which Google calendars appear
- proper event category rules you can edit
- workout logging/history
- assignment/exam model
- research experiment tracker
- internship application pipeline
- money model
- notifications / reminders
- richer offline support
