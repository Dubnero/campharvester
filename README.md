# CampHarvester

CampHarvester is an internal admin prototype for collecting, reviewing and managing Irish kids' camp listings. This first version is intentionally mock-data only and is focused on manual review workflows for Wicklow and Dublin listings.

## What is included

- Dashboard metrics for total, draft, approved, needs-review, and camps linked to verified or featured providers.
- Separate mock `Provider` and `Camp` data models, with each camp referencing a `provider_id`.
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

## Data model

Providers are stored locally in mock data with these fields:

```text
provider_id, provider_name, website, email, phone, description, verified, featured
```

Camps store camp-specific listing details and reference providers by `provider_id`; provider names, websites, emails and flags are resolved through that relationship in the UI.

## CSV import format

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
