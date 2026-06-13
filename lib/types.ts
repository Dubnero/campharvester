export const holidayTypes = [
  "Summer",
  "Easter",
  "Halloween",
  "February Midterm",
  "October Midterm",
  "Christmas",
  "Other",
] as const;

export const campStatuses = ["draft", "approved", "needs_review"] as const;

export const dayLengths = ["Half day", "Full day", "Both", "Unknown"] as const;

export type HolidayType = (typeof holidayTypes)[number];
export type CampStatus = (typeof campStatuses)[number];
export type DayLength = (typeof dayLengths)[number];

export type Provider = {
  provider_id: string;
  provider_name: string;
  website: string;
  email: string;
  phone: string;
  description: string;
  verified: boolean;
  featured: boolean;
};

export type Camp = {
  id: string;
  provider_id: string;
  camp_name: string;
  location: string;
  county: string;
  address: string;
  activity_type: string;
  holiday_type: HolidayType;
  age_min: number;
  age_max: number;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  half_day_or_full_day: DayLength;
  price: string;
  booking_url: string;
  contact_email: string;
  source_url: string;
  last_checked_date: string;
  slug: string;
  status: CampStatus;
  notes: string;
};

export type AdminRoute = {
  href: "/" | "/camps/import" | "/providers";
  label: string;
};

export type ImportResult = {
  camps: Camp[];
  errors: string[];
};

export type ProviderImportResult = {
  providers: Provider[];
  errors: string[];
};
