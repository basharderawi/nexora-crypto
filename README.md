# Nexora Crypto

## Environment variables

Configure `.env.local` (see `.env.local.example` if present).

### Required for app
- `NEXT_PUBLIC_SUPABASE_URL` – Supabase project URL (Settings → API → Project URL)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` – Supabase anon/public key
- `SUPABASE_URL` – Same as project URL (server-side)
- `SUPABASE_SERVICE_ROLE_KEY` – Supabase service role key (server-only)

### Required for admin system reset
- `ADMIN_EMAIL` – Email of the admin user allowed to call `/api/admin/system-reset` (must match logged-in Supabase user; never use NEXT_PUBLIC)
