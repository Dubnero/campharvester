# CampHarvester

CampHarvester is an internal admin prototype for collecting, reviewing and managing Irish kids' camp listings. Supabase is now the primary persistence layer for provider and camp imports, with browser `localStorage` kept as a temporary fallback for offline or misconfigured environments.

## What is included

- Dashboard metrics for total, draft, approved, needs-review, and camps linked to verified or featured providers.
- Separate `Provider` and `Camp` data models, with each camp referencing a `provider_id`.
- Searchable and filterable camp listing table that resolves provider details from the provider list.
- Full edit form for every camp field, including provider selection and camp status controls.
- CSV import with required-column, allowed-value and provider relationship validation.
- CSV export for the current visible camp list.
- Public directory and detail pages that preserve filters, sorting and SEO metadata.
- Ten realistic mock camp examples across Wicklow and Dublin, backed by ten mock providers for local fallback/demo use.

## What is intentionally not included yet

- Booking functionality.
- Payments.
- Provider accounts.
- Authentication.
- Scraping.
- OpenAI integration.

## Local setup

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

Build for production:

```bash
npm run build
```

## Supabase setup

CampHarvester expects an existing Supabase project with public read policies already configured for these tables:

- `providers`, keyed by `provider_id`.
- `camps`, keyed by `id`.

The app uses `@supabase/supabase-js` through a shared client in `lib/supabase.ts`. Data access is centralized in `lib/dataRepository.ts`:

- `getProviders()` reads provider rows from Supabase.
- `upsertProviders()` upserts provider import rows by `provider_id`.
- `getCamps()` reads camp rows from Supabase.
- `upsertCamps()` upserts camp import rows by `id`.

### Environment variables

Set these variables locally and in Vercel:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

The public anon key is used only for public read operations and CSV import upserts that your Supabase policies allow.

## Data flow architecture

1. Pages start with bundled mock data so the UI can render immediately.
2. Client components attempt to load providers and camps from Supabase first.
3. If Supabase is configured and returns data, the dashboard, import pages and public directory show a banner that Supabase data is active.
4. If Supabase is unavailable, misconfigured or empty, the app falls back to browser `localStorage` and then bundled mock data.
5. Accepting a provider import upserts rows to Supabase, still writes `campharvester.providers` as a temporary fallback, and refreshes the provider list from Supabase after a successful upsert.
6. Accepting a camp import upserts rows to Supabase, still writes `campharvester.camps` as a temporary fallback, and refreshes the camp list from Supabase after a successful upsert.
7. The public directory and detail pages read from Supabase first and preserve the existing client-side filters, sorting and detail URL behavior.

## Browser localStorage fallback

Local fallback keys are still supported while Supabase is the primary data source:

- Imported providers are stored under `campharvester.providers` after a provider CSV import is accepted.
- Imported camps are stored under `campharvester.camps` after a Camps Import Wizard import is accepted.
- Banners indicate whether the current view is using Supabase data or local fallback data.

## localStorage migration utility

`lib/localStorageMigration.ts` exports `migrateLocalStorageToSupabaseIfEmpty()`. Client import/dashboard flows call it before loading Supabase data. If either Supabase table is empty and matching localStorage data exists, the utility pushes the localStorage rows into Supabase.

This is intended as a one-time bridge for existing browser data and is safe to call repeatedly because it only writes localStorage rows when the corresponding Supabase table is empty.

## Data model

Providers are stored with these fields:

```text
provider_id, provider_name, website, email, phone, description, verified, featured
```

Camps store camp-specific listing details and reference providers by `provider_id`; provider names, websites, emails and flags are resolved through that relationship in the UI.

## CSV import format

The importer expects camp rows with a header row. Required camp columns are:

```text
camp_id, provider_id, camp_name, county, town, address, eircode, activity_type, holiday_type, age_min, age_max, start_date, end_date, start_time, end_time, half_day_or_full_day, price, booking_url, status, verified, featured, source_url, last_checked
```

Optional camp columns are preserved when present:

```text
Optional fields can be left blank, but location and slug are no longer required by the current import schema.
```

Allowed values:

- `holiday_type`: `Summer`, `Easter`, `Halloween`, `February Midterm`, `October Midterm`, `Christmas`, `Other`
- `status`: `draft`, `approved`, `needs_review`
- `half_day_or_full_day`: `Half day`, `Full day`, `Both`, `Unknown`

Imported camp rows must use a `provider_id` that exists in the current provider list from Supabase, localStorage fallback or bundled mock data.
