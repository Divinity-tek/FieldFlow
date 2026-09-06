# FieldFlow — Setup & Deployment Guide

A standalone Vite + React + TypeScript SPA backed by Supabase (Auth, Postgres + RLS,
Edge Functions). This guide covers local setup, database, test accounts, AI features,
and a cloud-agnostic production deployment.

---

## 1. Prerequisites

- Node.js 18+ and npm
- Supabase CLI (`npm i -g supabase`)
- A Supabase project (free tier is fine to start)
- (Optional, for AI) Ollama, or a Groq / Gemini API key

---

## 2. Install

```sh
npm install --legacy-peer-deps
```

> `--legacy-peer-deps` is needed because `@react-leaflet/core` declares an older
> React peer range. It works fine on React 18. (Or use `bun install`.)

---

## 3. Configure environment

The frontend reads three **public** values from `.env` (safe to ship to browsers):

```
VITE_SUPABASE_PROJECT_ID="your-project-ref"
VITE_SUPABASE_URL="https://your-project-ref.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."   # or legacy anon JWT
```

Find these in the Supabase Dashboard → Project Settings → API Keys.
**Never** put the secret/service_role key in a `VITE_*` variable.

---

## 4. Database (apply schema)

```sh
supabase login
supabase link --project-ref <your-project-ref>
supabase db push          # applies all migrations in supabase/migrations/
```

If `db push` fails on `gen_salt`/`crypt` (pgcrypto missing), run this once in the
Dashboard SQL Editor, then re-run `db push`:

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;
```

---

## 5. Test accounts

The four test users are not in migrations — create them once via the Dashboard
SQL Editor. Password for all: `NET@admin9876`.

```sql
DO $$
DECLARE rec RECORD; v_user_id uuid;
BEGIN
  FOR rec IN SELECT * FROM (VALUES
    ('admin@FieldFlow.local','Admin User','admin'),
    ('engineer@FieldFlow.local','Engineer User','engineer'),
    ('client@FieldFlow.local','Client User','client'),
    ('teamlead@FieldFlow.local','Team Lead User','team_lead')
  ) AS t(email,full_name,role)
  LOOP
    SELECT id INTO v_user_id FROM auth.users WHERE email=rec.email;
    IF v_user_id IS NULL THEN
      v_user_id := gen_random_uuid();
      INSERT INTO auth.users (instance_id,id,aud,role,email,encrypted_password,
        email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,
        confirmation_token,email_change,email_change_token_new,recovery_token)
      VALUES ('00000000-0000-0000-0000-000000000000',v_user_id,'authenticated','authenticated',
        rec.email,crypt('NET@admin9876',gen_salt('bf')),now(),
        jsonb_build_object('provider','email','providers',ARRAY['email']),
        jsonb_build_object('full_name',rec.full_name),now(),now(),'','','','');
    END IF;
    INSERT INTO auth.identities (id,user_id,identity_data,provider,provider_id,
      last_sign_in_at,created_at,updated_at)
    SELECT gen_random_uuid(),v_user_id,
      jsonb_build_object('sub',v_user_id::text,'email',rec.email,'email_verified',true),
      'email',v_user_id::text,now(),now(),now()
    WHERE NOT EXISTS (SELECT 1 FROM auth.identities i WHERE i.user_id=v_user_id AND i.provider='email');
    INSERT INTO public.user_roles (user_id,role) VALUES (v_user_id,rec.role::public.app_role)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;
```

Verify with `supabase/manual/check_test_accounts.sql`.

---

## 6. Run locally

```sh
npm run dev          # http://localhost:8080
```

---

## 7. AI features (optional)

AI is powered by Supabase Edge Functions that share a provider-configurable client
(`supabase/functions/_shared/ai.ts`). All providers speak the OpenAI chat-completions
format. Configure via Edge Function secrets:

| Secret | Purpose | Example |
|---|---|---|
| `AI_PROVIDER` | `ollama` \| `groq` \| `gemini` | `groq` |
| `AI_API_KEY` | provider key (not needed for Ollama) | `gsk_...` / `AIza...` |
| `AI_MODEL` | chat model | `llama-3.3-70b-versatile` |
| `AI_VISION_MODEL` | model for receipt OCR | `gemini-2.0-flash` |
| `AI_BASE_URL` | optional base-URL override | `http://localhost:11434/v1` |

**Deploy the functions** (Groq/Gemini — hosted):
```sh
supabase functions deploy
supabase secrets set AI_PROVIDER=groq AI_API_KEY=gsk_xxx AI_MODEL=llama-3.3-70b-versatile
```

**Ollama, local dev** (hosted functions can't reach your localhost, so serve locally):
```sh
ollama pull llama3.1 && ollama pull llava
supabase functions serve --env-file ./supabase/.env.local
```

**Ollama, production:** run Ollama on the same server as the functions and set
`AI_BASE_URL` to that server's Ollama address.

---

## 8. Production build

```sh
npm run build        # outputs static files to dist/
npm run preview      # optional: preview the build locally
```

The result in `dist/` is a static SPA — no Node server required at runtime.

---

## 9. Deploy (cloud-agnostic)

The frontend and the backend deploy independently.

### Frontend (`dist/`)
Serve the static files from any host. Two routing rules matter for a SPA:
1. Serve `index.html` for unknown paths (so deep links / refresh work).
2. Set the three `VITE_SUPABASE_*` values at build time.

**Option A — Static host / CDN** (simplest, scales effortlessly):
Vercel, Netlify, Cloudflare Pages, AWS S3+CloudFront, etc. Point it at the repo,
set the env vars, build command `npm run build`, output dir `dist/`.

**Option B — Your own VPS** (any provider: Hetzner, DigitalOcean, Linode, AWS EC2,
GCP, Azure VM…). Build, copy `dist/` to the server, and serve with Nginx or Caddy.

Nginx SPA config:
```nginx
server {
  listen 80;
  server_name your-domain.com;
  root /var/www/fieldflow/dist;
  index index.html;
  location / { try_files $uri $uri/ /index.html; }
}
```

Caddy (auto-HTTPS) — `Caddyfile`:
```
your-domain.com {
  root * /var/www/fieldflow/dist
  try_files {path} /index.html
  file_server
}
```

### Backend
Supabase hosts the database, auth, and (deployed) edge functions — there is no
separate server to run for these. Just `supabase db push` + `supabase functions deploy`.

### Choosing a host (you haven't decided yet)
- **Lowest effort:** a static host (Vercel/Netlify/Cloudflare Pages) — free tiers,
  automatic HTTPS, deep-link routing handled for you. Recommended unless you
  specifically need a VPS (e.g. to also run Ollama).
- **VPS:** pick any Linux VM provider; they're equivalent for serving a static SPA.
  Hetzner/DigitalOcean/Linode are cheap and simple; AWS/GCP/Azure if you need their
  broader ecosystem. Use a VPS if you want to self-host Ollama next to the app.

> Note on Supabase free tier: a project pauses after ~1 week of no database activity
> (≈30s cold start to resume) and runs on small shared compute — fine for dozens of
> concurrent users. Upgrade to Pro ($25/mo) to remove the pause and get daily backups.

---

## 10. Scripts

| Command | Description |
|---|---|
| `npm run dev` | Vite dev server (localhost:8080) |
| `npm run build` | Production build (runs route-integrity check first) |
| `npm run preview` | Preview the production build |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (Vitest) |
| `npm run check:routes` | Validate routes/sidebar/lazy-import integrity |
