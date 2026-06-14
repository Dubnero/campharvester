"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { loadStoredCamps } from "@/lib/campStorage";
import { loadStoredProviders } from "@/lib/providerStorage";
import { getCamps, getProviders } from "@/lib/dataRepository";
import { buildPublicCamps, findPublicCamp, formatAgeRange, formatDateRange, formatTimeRange } from "@/lib/publicDirectoryUtils";
import type { Camp, Provider } from "@/lib/types";

type Props = { campId: string; initialCamps: Camp[]; initialProviders: Provider[] };

export function PublicCampDetails({ campId, initialCamps, initialProviders }: Props) {
  const [camps, setCamps] = useState(initialCamps);
  const [providers, setProviders] = useState(initialProviders);

  useEffect(() => {
    let active = true;

    async function loadDetailsData() {
      const [remoteProviders, remoteCamps] = await Promise.all([getProviders(), getCamps()]);
      if (!active) return;

      if (!remoteProviders.error && !remoteCamps.error && (remoteProviders.data.length > 0 || remoteCamps.data.length > 0)) {
        setProviders(remoteProviders.data.length > 0 ? remoteProviders.data : initialProviders);
        setCamps(remoteCamps.data.length > 0 ? remoteCamps.data : initialCamps);
      } else {
        setProviders(loadStoredProviders() ?? initialProviders);
        setCamps(loadStoredCamps() ?? initialCamps);
      }
    }

    loadDetailsData();
    return () => { active = false; };
  }, [initialCamps, initialProviders]);

  const camp = useMemo(() => findPublicCamp(buildPublicCamps(camps, providers), campId), [campId, camps, providers]);

  if (!camp) {
    return (
      <main className="public-shell">
        <section className="public-panel empty-detail">
          <h1>Camp not found</h1>
          <p>We could not find that camp listing. It may have been removed or replaced by a newer import.</p>
          <Link className="button-link" href="/camps">Back to camps</Link>
        </section>
      </main>
    );
  }

  const actionHref = camp.booking_url || camp.provider?.website || "mailto:" + (camp.provider?.primary_email ?? "");
  const actionLabel = camp.booking_url ? "Book Camp" : "Contact Provider";

  return (
    <main className="public-shell">
      <Link className="back-link" href="/camps">← Back to all camps</Link>
      <article className="public-detail">
        <header className="detail-hero">
          <p className="eyebrow">{camp.activity_type} · {camp.holiday_type}</p>
          <h1>{camp.camp_name}</h1>
          <p>{camp.provider?.provider_name ?? "Provider details coming soon"}</p>
          <a className="button-link" href={actionHref}>{actionLabel}</a>
        </header>
        <section className="detail-grid">
          <div className="detail-description"><h2>About this camp</h2><p>{camp.provider?.description || "A full description for this camp will be added as soon as the provider supplies it."}</p></div>
          <dl className="detail-list">
            <div><dt>Provider</dt><dd>{camp.provider?.provider_name ?? camp.provider_id}</dd></div>
            <div><dt>Town</dt><dd>{camp.town || "To be confirmed"}</dd></div>
            <div><dt>County</dt><dd>{camp.county || "To be confirmed"}</dd></div>
            <div><dt>Address</dt><dd>{camp.address || "To be confirmed"}</dd></div>
            <div><dt>Eircode</dt><dd>{camp.eircode || "To be confirmed"}</dd></div>
            <div><dt>Activity type</dt><dd>{camp.activity_type}</dd></div>
            <div><dt>Holiday type</dt><dd>{camp.holiday_type}</dd></div>
            <div><dt>Age range</dt><dd>{formatAgeRange(camp.age_min, camp.age_max)}</dd></div>
            <div><dt>Dates</dt><dd>{formatDateRange(camp.start_date, camp.end_date)}</dd></div>
            <div><dt>Times</dt><dd>{formatTimeRange(camp.start_time, camp.end_time)}</dd></div>
            <div><dt>Price</dt><dd>{camp.price || "Price to be confirmed"}</dd></div>
            <div><dt>Website</dt><dd>{camp.provider?.website ? <a href={camp.provider.website}>{camp.provider.website}</a> : "To be confirmed"}</dd></div>
            <div><dt>Booking URL</dt><dd>{camp.booking_url ? <a href={camp.booking_url}>{camp.booking_url}</a> : "Contact provider for booking details"}</dd></div>
          </dl>
        </section>
      </article>
    </main>
  );
}
