# CampHarvester

CampHarvester is an internal admin prototype for collecting, reviewing and managing Irish kids' camp listings. This first version is intentionally mock-data only and is focused on manual review workflows for Wicklow and Dublin listings.

## What is included

- Dashboard metrics for total, draft, approved, needs-review, and camps linked to verified or featured providers.
- Separate mock `Provider` and `Camp` data models, with each camp referencing a `provider_id`.
- Provider import page for uploading `providers.csv`, searching providers, and reviewing provider totals, verified counts and featured counts.
- Camps import wizard for uploading `camps.csv`, reviewing validation errors/warnings, and accepting clean imports locally.
- Searchable and filterable camp listing table that resolves provider details from the local provider list.
- Full edit form for every camp field, including provider selection and camp status controls.
- CSV import with required-column, allowed-value and provider relationship validation.
- CSV export for the current visible camp list.
- Ten realistic mock camp examples across Wicklow and Dublin, backed by ten mock providers.

## What is intentionally not included yet

- Public directory pages.
- Booking functionality.
- Payments.
- Provider accounts.
- Authentication.
- Supabase integration.
- Scraping.
- OpenAI integration.

## Admin routes

| Route | Purpose |
| --- | --- |
| `/` | Camp admin dashboard, listing table, edit form, camp CSV import/export. |
| `/camps/import` | Camps Import Wizard for validating `camps.csv` before accepting clean rows locally. |
| `/providers` | Provider Import page for uploading and searching local `providers.csv` data. |

## Local setup

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser for camp review, [http://localhost:3000/camps/import](http://localhost:3000/camps/import) for camp imports, or [http://localhost:3000/providers](http://localhost:3000/providers) for provider imports.

Build for production:

```bash
npm run build
```

## Data model

Providers are stored locally in mock data and can be replaced in browser memory by importing `providers.csv` with these fields:

```text
provider_id, provider_name, website, email, phone, description, verified, featured
```

Camps store camp-specific listing details and reference providers by `provider_id`; provider names, websites, emails and flags are resolved through that relationship in the UI. Provider imports remain local to the provider page and do not write to a database.

## Camps CSV import format

The camp import wizard validates `camps.csv` before local import. It checks that `provider_id` exists, detects duplicate `camp_id`/`id` values, warns on likely duplicate camp records with the same provider, venue and start date, and reports missing `camp_name`, `booking_url` or `holiday_type`, invalid age ranges, and date ranges where `start_date` is after `end_date`.

The importer expects camp rows with a header row. Required camp columns are:

```text
id, provider_id, camp_name, location, county, activity_type, holiday_type, age_min, age_max, start_date, end_date, half_day_or_full_day, slug, status
```

Optional camp columns are preserved when present:

```text
address, start_time, end_time, price, booking_url, contact_email, source_url, last_checked_date, notes
```

Allowed values:

- `holiday_type`: `Summer`, `Easter`, `Halloween`, `February Midterm`, `October Midterm`, `Christmas`, `Other`
- `status`: `draft`, `approved`, `needs_review`
- `half_day_or_full_day`: `Half day`, `Full day`, `Both`, `Unknown`

Imported camp rows must use a `provider_id` that exists in the local mock provider list.
