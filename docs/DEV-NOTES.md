# Developer Handover Notes — W Automobiles

Technical reference for maintaining the Supabase database, RLS security model, Cloudinary pipeline, on-demand revalidation, and operational procedures.

---

## 1. Database Schema & Migrations

Migrations live in `supabase/migrations/`:

- **`001_init.sql`**:
  - `public.admin_config(id boolean PK check (id = true), email text, updated_at timestamptz)` — single-row table storing the sole admin email. RLS enabled with zero policies and `REVOKE ALL` from `public, anon, authenticated`.
  - `public.is_admin()` — `SECURITY DEFINER`, `STABLE`, `SET search_path = ''`. Returns `true` only when `auth.uid() IS NOT NULL` and `auth.jwt() ->> 'email'` matches `public.admin_config.email` (case-insensitive, trimmed).
  - `public.cars` — vehicle catalogue with `CHECK` constraints (`year`, `mileage`, `fuel`, `transmission`, `body_type`, `condition`, `status`, `doors`, `seats`, `images` JSONB array, and `cars_price_required_unless_on_request`), `set_cars_updated_at` trigger, and indexes on `slug`, `published`, `featured`, `status`, and `brand`.
- **`002_max_featured_trigger.sql`**:
  - `enforce_max_featured_cars()` — `BEFORE INSERT OR UPDATE OF featured` trigger enforcing a hard database-level limit of 6 featured vehicles (`check_violation` error if exceeded).

### RLS Policies on `public.cars`

| Operation | Role | Policy |
| :--- | :--- | :--- |
| `SELECT` | `anon`, `authenticated` | `published = true` |
| `SELECT` | `authenticated` | `public.is_admin()` (sees all rows including drafts) |
| `INSERT` | `authenticated` | `WITH CHECK (public.is_admin())` |
| `UPDATE` | `authenticated` | `USING (public.is_admin()) WITH CHECK (public.is_admin())` |
| `DELETE` | `authenticated` | `USING (public.is_admin())` |

---

## 2. Caching & On-Demand Revalidation

- Public reads in `lib/cars.ts` use the cookie-less anon client (`lib/supabase/public.ts`) wrapped in `unstable_cache` with tags `"cars"` and `"car:<slug>"` (`revalidate: 3600`).
- `/vehicules/[slug]` uses `generateStaticParams` + `export const dynamicParams = true` so newly created cars render immediately without a rebuild.
- Every admin mutation in `lib/actions/cars.ts` calls `revalidateCars(slug)` (`lib/revalidate.ts`), which triggers:
  - `revalidateTag("cars")` and `revalidateTag("car:" + slug)`
  - `revalidatePath("/")`, `revalidatePath("/vehicules")`, `revalidatePath("/vehicules/" + slug)`, `revalidatePath("/contact")`, `revalidatePath("/sitemap.xml")`
- When a vehicle's slug changes, both the new slug and old slug are revalidated.

---

## 3. Authentication & Security Architecture

- **Route groups**:
  - `app/(site)/` — public site (Header, Footer, Lenis, GSAP, Three.js, Preloader, PageTransition).
  - `app/(admin)/admin/` — completely isolated layout (`noindex, nofollow`, zero GSAP/Lenis/Three.js).
- **Server verification**:
  - `middleware.ts` runs strictly on `/admin` and `/admin/:path*`, refreshes cookies, and verifies `getUser()` + `is_admin()`.
  - `lib/auth/requireAdmin.ts` is called in every admin page, Server Action, and API route handler (`/api/admin/cloudinary/*`). Always uses `supabase.auth.getUser()` (never `getSession()`).
- **Security headers**: Configured in `next.config.mjs` (`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Content-Security-Policy`, plus `X-Frame-Options: DENY`, `X-Robots-Tag: noindex, nofollow`, and `frame-ancestors 'none'` on `/admin/:path*`).

---

## 4. Operational Runbooks

### Reset the Admin Password in Supabase
1. Go to **Supabase Dashboard → Authentication → Users**.
2. Click the admin user → **Send password recovery** (or set a new password directly via **Update user**).
3. If changing the admin email address, also update `public.admin_config`:
   ```sql
   update public.admin_config
      set email = 'new-admin@example.com', updated_at = now()
    where id = true;
   ```

### Rotate Supabase Keys
1. In **Supabase Dashboard → Project Settings → API**, regenerate the **anon** or **service_role** key (or rotate the JWT secret if compromised).
2. Update `NEXT_PUBLIC_SUPABASE_ANON_KEY` and/or `SUPABASE_SERVICE_ROLE_KEY` in **Vercel → Project Settings → Environment Variables** and in local `.env.local`.
3. Trigger a fresh Vercel deployment so static chunks and server functions pick up the new keys.

### Rotate Cloudinary Keys
1. In **Cloudinary Console → Settings → Access Keys**, generate a new API key/secret pair (keep the old pair active briefly during rollout).
2. Update `NEXT_PUBLIC_CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` in Vercel and `.env.local`.
3. Redeploy on Vercel, verify `/admin/health` shows Cloudinary **OK**, test one upload, then revoke the old key pair in Cloudinary.

### Database Backups
- **Quick CSV export (no CLI)**: Supabase Dashboard → **Table Editor → `cars` → Export → Export to CSV**.
- **Full SQL backup (`pg_dump`)**:
  ```bash
  pg_dump "$SUPABASE_DB_URL" --schema=public --table=public.cars --table=public.admin_config > backup_w_automobiles_$(date +%Y%m%d).sql
  ```
- **Automated backups**: Supabase Pro includes daily automated backups and Point-in-Time Recovery (PITR). On the Free tier, schedule a monthly CSV export or `pg_dump`.

---

## 5. Free-Tier Limits to Watch

- **Supabase Free Tier**:
  - **Inactivity pausing**: Projects with no database traffic for **7 consecutive days** are automatically paused. Visiting the site or running a lightweight weekly cron ping prevents pausing; if paused, click **Restore project** in the Supabase Dashboard.
  - Database size: 500 MB (more than enough for thousands of car listings since photos live on Cloudinary).
- **Cloudinary Free Tier**:
  - **25 monthly credits** (1 credit ≈ 1 GB storage OR 1 GB bandwidth OR 1,000 transformations).
  - Client-side compression (`max 2000px`, quality `0.85`), eager-free uploads, `f_auto,q_auto` delivery transforms, and automatic orphaned-image deletion keep usage well within the free tier.
- **Vercel Hobby Tier**:
  - Watch serverless function execution limits and image optimization quotas; `<CarImage>` offloads Cloudinary resizing directly to Cloudinary's CDN (`res.cloudinary.com`) so it does not consume Vercel Image Optimization quota.
