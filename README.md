# FieldFlow

AI-assisted Field Service Management platform — role-based portals for Admin, Team Lead,
Engineer, Client, Partner, Associate Coordinator and Service Desk.

**Stack:** React 18 · Vite · TypeScript · Tailwind / shadcn-ui · Supabase (Auth + Postgres + RLS + Edge Functions) · React Query · React Router v6.

## Prerequisites

- Node.js 18+ and npm
- A Supabase project

## Setup

```sh
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
#   then fill in your Supabase values in .env:
#   VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_SUPABASE_PROJECT_ID

# 3. Run the dev server (http://localhost:8080)
npm run dev
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Production build (runs the route-integrity check first) |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |
| `npm test` | Run unit tests (Vitest) |
| `npm run check:routes` | Validate routes/sidebar/lazy-import integrity |

## Database

Migrations live in `supabase/migrations/`. Apply them with the Supabase CLI:

```sh
supabase db push
```

One-off operational SQL (bootstrap an admin, etc.) is in `supabase/manual/`.

## Deployment

This is a standard static Vite SPA — build with `npm run build` and deploy the
`dist/` folder to any static host (Vercel, Netlify, Cloudflare Pages, S3+CloudFront, etc.).
Set the three `VITE_SUPABASE_*` environment variables in your host's project settings.

## AI features

The Supabase Edge Functions under `supabase/functions/` power the AI features
(assistant, job reports, smart scheduling, dispatch agent, receipt OCR, landing
chat). They are independent of the frontend build/deploy and share a single,
provider-configurable client at `supabase/functions/_shared/ai.ts`.

All supported providers speak the OpenAI `chat/completions` wire format, so you
can point at a **local Ollama**, **Groq**, or **Gemini** by setting Edge Function
secrets (Supabase Dashboard → Edge Functions → Secrets):

| Secret | Purpose | Example |
|---|---|---|
| `AI_PROVIDER` | `ollama` \| `groq` \| `gemini` (default `ollama`) | `groq` |
| `AI_API_KEY` | Provider API key (not needed for Ollama) | `gsk_...` / `AIza...` |
| `AI_MODEL` | Chat model id | `llama-3.3-70b-versatile` |
| `AI_VISION_MODEL` | Model for image/OCR (defaults to `AI_MODEL`) | `gemini-2.0-flash` |
| `AI_BASE_URL` | Optional base-URL override (self-hosted/custom) | `http://localhost:11434/v1` |

Provider defaults:

- **Ollama** — base `http://localhost:11434/v1`, model `llama3.1`, vision `llava` (no key required)
- **Groq** — base `https://api.groq.com/openai/v1`, model `llama-3.3-70b-versatile`
- **Gemini** — base `https://generativelanguage.googleapis.com/v1beta/openai`, model `gemini-2.0-flash`

> Receipt OCR (`engineer-ocr-receipt`) sends an image, so the configured provider/model
> must support vision. Set `AI_VISION_MODEL` accordingly (e.g. `llava` for Ollama,
> a Llama-4 vision model for Groq, or any Gemini flash model).
