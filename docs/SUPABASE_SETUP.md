# Supabase backend setup

This app uses [Supabase](https://supabase.com) for auth and (optionally) database, storage, and realtime.

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and sign in.
2. Create a new project (e.g. `athlete-social`).
3. In **Project Settings → API**, copy:
   - **Project URL** → `EXPO_PUBLIC_SUPABASE_URL`
   - **anon public** key → `EXPO_PUBLIC_SUPABASE_ANON_KEY`

## 2. Configure environment variables

1. Copy the example env file:
   ```bash
   cp .env.example .env
   ```
2. Edit `.env` and set:
   - `EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key`

Expo only exposes variables prefixed with `EXPO_PUBLIC_` to the app. Restart the dev server after changing `.env`.

## 3. Auth (already wired)

- **Login** and **Sign up** use Supabase Auth (email/password).
- Session is stored with AsyncStorage and restored on app open.
- **Settings → Log out** calls `signOut()` and redirects to the welcome screen.

Optional in Supabase Dashboard:

- **Authentication → Providers**: enable/disable Email, Google, Apple, etc.
- **Authentication → Email Templates**: customize confirm and reset emails.
- **Authentication → Settings**: turn “Confirm email” on/off for signup.

### Email confirmation (required before app access)

1. In **Authentication → Providers → Email**, enable **Confirm email** (recommended for production).
2. Under **Authentication → URL Configuration → Redirect URLs**, add the URL printed in the dev console as `[emailConfirmation] Add this URL to Supabase Redirect URLs:` (from `getSignupEmailRedirectUrl()` in `lib/emailConfirmation.ts`). Examples:
   - **Expo Go / dev**: `exp://…/--/auth/confirm`
   - **Standalone / dev build / production**: `myapp://auth/confirm` (see `scheme` in `app.json`)
3. After sign-up, the app routes to **`/auth/confirm`** until `user.email_confirmed_at` is set. The confirmation email link should open the app via that redirect URL; deep-link handling is in `hooks/useAuthDeepLinks.ts` (`verifyOtp` / `setSession` / PKCE).

### Password reset email (clickable link)

If the reset email has **no tappable link**, the **Reset password** template body is missing a real `href`. In **Authentication → Email Templates → Reset password**, the HTML must use Supabase’s confirmation URL on an anchor (or button), for example:

```html
<h2>Reset your password</h2>
<p><a href="{{ .ConfirmationURL }}">Reset password</a></p>
<p>Alternatively, enter this code in the app (Forgot password → Enter reset code): {{ .Token }}</p>
<p>If the button does not work, copy and paste this URL into your browser:</p>
<p>{{ .ConfirmationURL }}</p>
```

Use [Go template syntax](https://supabase.com/docs/guides/auth/auth-email-templates) (`{{ .ConfirmationURL }}`, `{{ .Token }}`). Plain text like “Reset password” with no `<a href="...">` will not be clickable.

Add your app’s recovery redirect to **Authentication → URL Configuration → Redirect URLs** (the same URL the app logs in dev from `getPasswordRecoveryRedirectUrl()` in `lib/passwordRecovery.ts`, e.g. `myapp://reset-password` for production builds).

### Reset link opens Chrome and shows “This site can’t be reached” (Android / Expo)

What happens: the email link first opens **Supabase** in the browser, then redirects to your **`redirectTo`** URL (from `resetPasswordForEmail`). That URL is often an **app deep link**, not a website:

- **Expo Go / dev**: `redirectTo` is usually an **`exp://…`** address (your machine’s IP + Metro). Chrome **cannot open** `exp://` as a normal page, so Android may show an error. The IP can also be wrong if the phone is not on the same LAN as your computer.
- **Production**: `redirectTo` is typically **`myapp://reset-password`**. Chrome may not hand off to your app until you use a **development build** or **store build** with your `scheme` configured in `app.json` (Expo Go uses its own scheme, not always `myapp`).

**What to do**

1. **Use the in-app code path** (recommended when the link fails): after requesting a reset, open **Forgot password → Have a code from your email?** (or **Enter reset code** on the confirmation step) and go to **`/auth/reset-code`**. Enter the same email and the **code** from the email. The app calls `verifyOtp` with `type: 'recovery'` and then sends you to **Update password** (`/reset-password`). Your reset email template must include **`{{ .Token }}`** for the code (see [email templates](https://supabase.com/docs/guides/auth/auth-email-templates)).
2. For **link-based** reset on a real device, use a **development build** or release APK/IPA with your app’s scheme, and add that exact `redirectTo` URL to Supabase **Redirect URLs**.
3. Optional: host an **HTTPS** page (e.g. on Netlify) that only redirects to `myapp://reset-password#…` or shows an “Open app” button—add that **https://…** URL to **Redirect URLs** and pass it as `redirectTo` if you need a bridge.

## 4. Email and username uniqueness

- **Email**: On "Continue" after the email step, the app calls `check_email_available` so duplicate emails are rejected before the name screen.
- **Username**: On "Continue" after the username step, the app calls `check_username_available` so taken usernames are rejected before the password screen (case-insensitive).
- **Required**: Run both RPC migrations in **SQL Editor** (or `supabase db push` if using the CLI):
  - `supabase/migrations/20250304000001_add_check_email_available_rpc.sql`
  - `supabase/migrations/20250304000002_add_check_username_available_rpc.sql`
- **Profiles**: To enforce unique email in `public.profiles`, run `supabase/migrations/20250304000000_add_profiles_email_unique.sql` in SQL Editor as well.

## 5. Storage (profile pictures and banners)

Sign-up and edit profile can save profile and banner images.

1. **Buckets** – In **SQL Editor**, run:
   - `supabase/migrations/20250309000000_add_storage_buckets_avatars_banners.sql`  
   This creates public buckets `avatars` and `banners`.

2. **Policies** – Run the remainder in **SQL Editor**:
   - `supabase/migrations/20250309000001_add_storage_policies_avatars_banners.sql`  
   This adds RLS so authenticated users can upload/update/delete only their own files under `avatars/{user_id}/...` and `banners/{user_id}/...`.

   If you get **"must be owner of table objects"**, create the policies in the Dashboard instead:
   - Go to **Storage** → open bucket **avatars** → **Policies** → **New policy**.
   - For each operation (Insert, Update, Delete), add a policy that allows **authenticated** users with a check like:  
     `(bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)`  
     (Use “Use this template” → “Allow access to a specific folder” and set the folder to the user id if available, or paste the expression in the policy builder.)
   - Repeat for bucket **banners** with `bucket_id = 'banners'` in the check.

## 6. Next steps (database)

- In Supabase **Table Editor**, create tables (e.g. `profiles`, `posts`).
- Run `npx supabase gen types typescript --project-id YOUR_REF > types/database.ts` to update TypeScript types.
- Use `supabase.from('table_name')` in the app for queries (see [Supabase JS docs](https://supabase.com/docs/reference/javascript)).

Realtime works the same way: use the same `supabase` client from `@/lib/supabase`.
