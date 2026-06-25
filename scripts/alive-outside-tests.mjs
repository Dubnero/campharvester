import assert from 'node:assert/strict';
import { extractDiscoveryRecords, buildExtractionDebug } from '../lib/discoveryUtils.ts';
import { POST } from '../app/api/discovery/fetch/route.ts';

const sourceUrl = 'https://www.aliveoutside.ie/summer-camps-dublin-wicklow-2026-alive-outside-summer-camps/';
const rathgarUrl = 'https://www.aliveoutside.ie/activity-package/summer-camp-thehighschool/';
const swordsUrl = 'https://www.aliveoutside.ie/activity-package/summer-camp-swords/';
const grangegormanUrl = 'https://www.aliveoutside.ie/activity-package/summer-camp-tudgrangegorman/';
const brayUrl = 'https://www.aliveoutside.ie/activity-package/summer-camp-killruddery/';
const futureUrl = 'https://www.aliveoutside.ie/activity-package/summer-camp-malahide/';

const listingText = `
Alive Outside Summer Camps 2026
Summer Camps Dublin & Wicklow 2026
Ages 7 to 13
Summer Camp Prices 2026 €30 deposit
Summer Camp Locations in Dublin & Wicklow 2026
The High School, Rathgar, Dublin 6
6th July to 10th July 2026
13th July to 17th July 2026
20th July to 24th July 2026
10th August to 14th August 2026
${rathgarUrl}
Coláiste Choilm, Swords, Co. Dublin
27th July to 31st July 2026
${swordsUrl}
TUD Grangegorman, Dublin 7
17th August to 21st August 2026
${grangegormanUrl}
Killruddery Estate, Southern Cross Road, Bray, Co. Wicklow A98 W9F2
29th June to 3rd July 2026
6th July to 10th July 2026
13th July to 17th July 2026
20th July to 24th July 2026
27th July to 31st July 2026
4th August to 7th August 2026
10th August to 14th August 2026
17th August to 21st August 2026
24th August to 28th August 2026
${brayUrl}
https://www.aliveoutside.ie/book-now/
Book the Rathgar summer camp
HELL & BACK Assault Course - Corporate Team Building
Birthday Parties
parent testimonials
poster Canva asset title
What the Summer Camp includes
`;

const crawledText = `
Source URL: ${sourceUrl}
${listingText}

Source URL: ${rathgarUrl}
Summer Camp The High School Rathgar
Location: The High School, Rathgar, Dublin 6
Ages 7-13
Duration 6 hours per day
Full price €182
Footer Killruddery Estate A98 W9F2
Rezgo package https://aliveoutside.rezgo.com/details/111111/summer-camp-thehighschool

Source URL: ${swordsUrl}
Summer Camp Swords
Venue Coláiste Choilm, Swords, Co. Dublin
Ages 7 to 13
Duration 6 hours daily
Price €150
Footer Killruddery Estate A98 W9F2
€30 deposit required

Source URL: ${grangegormanUrl}
Summer Camp TUD Grangegorman
Location TUD Grangegorman, Dublin 7
Age 7-13
Duration 5.5 hours per day
Total €150
Footer Killruddery Estate A98 W9F2

Source URL: ${brayUrl}
Summer Camp Killruddery
Venue Killruddery Estate, Southern Cross Road, Bray, Co. Wicklow A98 W9F2
Ages 7-13
Duration 6 hours per day
5 day camp €177
4 day camp €152
€30 deposit
`;

const records = extractDiscoveryRecords({ sourceUrl }, crawledText);
const camps = records.camps;
assert.equal(records.providers[0].provider_name, 'Alive Outside');
assert.equal(records.providers[0].provider_id, 'P0003');
assert.equal(records.providers[0].activity_category, 'Outdoor Adventure');
assert.equal(records.providers[0].provider_type, 'Private');
assert.equal(camps.length, 15);

const byTown = (town) => camps.filter((camp) => camp.town === town);
assert.deepEqual(byTown('Rathgar').map((camp) => `${camp.start_date}:${camp.end_date}`), [
  '2026-07-06:2026-07-10',
  '2026-07-13:2026-07-17',
  '2026-07-20:2026-07-24',
  '2026-08-10:2026-08-14',
]);
assert.equal(byTown('Swords').length, 1);
assert.equal(byTown('Swords')[0].start_date, '2026-07-27');
assert.equal(byTown('Grangegorman').length, 1);
assert.equal(byTown('Grangegorman')[0].start_date, '2026-08-17');
assert.equal(byTown('Bray').length, 9);
const brayFourDay = byTown('Bray').find((camp) => camp.start_date === '2026-08-04');
assert.ok(brayFourDay);
assert.equal(brayFourDay.end_date, '2026-08-07');

for (const camp of camps) {
  assert.equal(camp.age_min, 7);
  assert.equal(camp.age_max, 13);
  assert.notEqual(camp.price, '€30');
  assert.equal(camp.half_day_or_full_day, 'Full day');
  assert.equal(camp.start_time, '');
  assert.equal(camp.end_time, '');
  assert.ok(camp.extractionWarnings.includes('Times require review'));
  assert.equal(camp.booking_url.includes('/book-now'), false);
}

for (const camp of byTown('Rathgar')) {
  assert.equal(camp.price, '€182');
  assert.equal(camp.eircode, '');
  assert.equal(camp.extractionWarnings.includes('Full price requires review'), false);
  assert.equal(camp.booking_url, 'https://aliveoutside.rezgo.com/details/111111/summer-camp-thehighschool');
  assert.equal(camp.address, 'The High School, Rathgar, Dublin 6');
}
assert.equal(byTown('Swords')[0].price, '€150');
assert.equal(byTown('Swords')[0].eircode, '');
assert.equal(byTown('Swords')[0].extractionWarnings.includes('Full price requires review'), false);
assert.equal(byTown('Swords')[0].booking_url, swordsUrl);
assert.equal(byTown('Swords')[0].address, 'Coláiste Choilm, Swords, Co. Dublin');
assert.equal(byTown('Grangegorman')[0].price, '€150');
assert.equal(byTown('Grangegorman')[0].eircode, '');
assert.equal(byTown('Grangegorman')[0].extractionWarnings.includes('Full price requires review'), false);
assert.equal(byTown('Grangegorman')[0].booking_url, grangegormanUrl);
assert.equal(byTown('Grangegorman')[0].address, 'TUD Grangegorman, Dublin 7');
for (const camp of byTown('Bray')) {
  assert.equal(camp.price, camp.start_date === '2026-08-04' ? '€152' : '€177');
  assert.equal(camp.booking_url, brayUrl);
  assert.equal(camp.eircode, 'A98 W9F2');
  assert.equal(camp.extractionWarnings.includes('Full price requires review'), false);
}

const names = camps.map((camp) => camp.camp_name).join('\n');
for (const junk of ['Summer Camp Prices 2026', 'HELL & BACK Assault Course', 'Birthday Parties', 'testimonials', 'poster Canva']) {
  assert.equal(names.includes(junk), false);
}

const debug = buildExtractionDebug({ sourceUrl }, crawledText);
assert.ok(debug.stages.some((stage) => stage.label === 'Alive Outside provider-specific extractor detected' && stage.passed));
assert.ok(debug.stages.some((stage) => stage.label === 'Alive Outside camp records created' && stage.count === 15));
assert.ok(debug.candidateRows.every((row) => String(row.parsedFields.package_details_merged).includes('rathgar')));

const originalFetch = globalThis.fetch;
const packagePages = new Set([rathgarUrl, swordsUrl, grangegormanUrl, brayUrl]);
const fetched = [];
globalThis.fetch = async (url) => {
  const requested = String(url);
  fetched.push(requested);
  const html = requested === sourceUrl ? `
    <html><body>
      <a href="/book-now/">Book Now</a>
      <a href="/birthday-parties/">Birthday Parties</a>
      <script src="/wp-content/app.js"></script>
      <a href="${rathgarUrl}">Rathgar</a>
      <a href="${swordsUrl}">Swords</a>
      <a href="${grangegormanUrl}">Grangegorman</a>
      <a href="${brayUrl}">Bray</a>
      <a href="${brayUrl}">Bray duplicate</a>
      <a href="${futureUrl}">Future Malahide</a>
      <a href="/activity-package/birthday-party-summer-camp-style/">Birthday package</a>
      <a href="/blog/summer-camp-tips/">Blog</a>
      <img src="/wp-content/uploads/summer-camp-poster.jpg" />
    </body></html>` : `<html><body>Package detail for ${requested} camp ages 7-13 price €220 duration 6 hours per day</body></html>`;
  return { ok: true, text: async () => html };
};
try {
  const response = await POST(new Request('http://localhost/api/discovery/fetch', { method: 'POST', body: JSON.stringify({ url: sourceUrl }) }));
  const body = await response.json();
  assert.equal(body.analysisLog.aliveOutside.packageUrlsCrawled.length, 5);
  assert.equal(body.analysisLog.aliveOutside.packageUrlsPrioritised.length, 5);
  for (const url of packagePages) assert.ok(fetched.includes(url));
  assert.ok(fetched.includes(futureUrl));
  assert.equal(body.analysisLog.aliveOutside.packageUrlsDiscovered.filter((url) => url === brayUrl).length, 1);
  assert.equal(body.analysisLog.aliveOutside.packageUrlsDiscovered.includes(futureUrl), true);
  assert.equal(body.analysisLog.aliveOutside.packageUrlsDiscovered.some((url) => /book-now|birthday|corporate|\.jpg/i.test(url)), false);
  assert.equal(fetched.includes('https://www.aliveoutside.ie/book-now/'), false);
  assert.equal(body.analysisLog.aliveOutside.fallbackKnownUrlsUsed, false);
} finally {
  globalThis.fetch = originalFetch;
}


const fallbackFetched = [];
globalThis.fetch = async (url) => {
  const requested = String(url);
  fallbackFetched.push(requested);
  const html = requested === sourceUrl ? '<html><body><a href="/book-now/">Book Now</a><a href="/birthday-parties/">Birthday</a></body></html>' : `<html><body>Fallback package ${requested}</body></html>`;
  return { ok: true, text: async () => html };
};
try {
  const response = await POST(new Request('http://localhost/api/discovery/fetch', { method: 'POST', body: JSON.stringify({ url: sourceUrl }) }));
  const body = await response.json();
  assert.equal(body.analysisLog.aliveOutside.fallbackKnownUrlsUsed, true);
  for (const url of packagePages) assert.ok(fallbackFetched.includes(url));
} finally {
  globalThis.fetch = originalFetch;
}

console.log('Alive Outside regression tests passed');
