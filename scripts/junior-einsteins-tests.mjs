import assert from 'node:assert/strict';
import { extractDiscoveryRecords } from '../lib/discoveryUtils.ts';
import { uniqueOptions } from '../components/DiscoveryAssistant.tsx';

const input = { sourceUrl: 'https://junioreinsteinsscienceclub.com/science-camps-list-kids-childrens-camp/' };
const forbiddenLocationText = /Dates & Times|Ages:|Cost|daily/i;
function assertCleanLocation(camp) {
  assert.equal(forbiddenLocationText.test(`${camp.town} ${camp.address}`), false);
}

const fallbackText = `Junior Einsteins Science Club
Science Camps List
Jun 29 2026 - Jul 03 2026
Summer Science Camp for Kids -Rosemont School, Dublin 18 – Monday 29th June – Friday 3rd July (9am-1pm daily)
Book now
Dublin`;
const fallbackCamps = extractDiscoveryRecords(input, fallbackText).camps;
assert.equal(fallbackCamps.length, 1);
assert.equal(fallbackCamps[0].start_date, '2026-06-29');
assert.equal(fallbackCamps[0].end_date, '2026-07-03');
const canonicalProviderRecords = extractDiscoveryRecords({ ...input, providerName: 'Junior Einstein Science Club' }, fallbackText);
assert.equal(canonicalProviderRecords.providers[0].provider_name, 'Junior Einsteins Science Club');
assert.equal(canonicalProviderRecords.providers.some((provider) => provider.provider_name === 'Junior Einstein Science Club'), false);

const eventUrl = 'https://junioreinsteinsscienceclub.com/events/malahide-castle-gardens-dublin-science-summer-camp-for-kids-monday-29th-june-to-friday-3rd-july-930am-130pm-daily/';
const eventText = `Source URL: ${input.sourceUrl}
Junior Einsteins Science Club
Science Camps List
Jun 29 2026 - Jul 03 2026
Book now
Source URL: ${eventUrl}
Malahide Castle Gardens Dublin Science Summer Camp for Kids Monday 29th June to Friday 3rd July 930am 130pm daily
Address: Malahide Castle & Gardens, Back Road, Malahide, Co. Dublin Dates & Times: Monday 29th June to Friday 3rd July
Cost:
€198
Age Groups:
Suitable for 5 -11 years old; grouped by age (5-8 year olds ATOMS & 9-11 year olds MOLECULES).
Date:
Jun 29 2026 - Jul 03 2026
Time:
09:30 AM - 01:30 PM`;
const eventCamps = extractDiscoveryRecords(input, eventText).camps;
assert.equal(eventCamps.length, 1);
assert.equal(eventCamps[0].start_date, '2026-06-29');
assert.equal(eventCamps[0].end_date, '2026-07-03');
assert.equal(eventCamps[0].start_time, '09:30');
assert.equal(eventCamps[0].end_time, '13:30');
assert.equal(eventCamps[0].town, 'Malahide');
assert.equal(eventCamps[0].county, 'Dublin');
assert.equal(eventCamps[0].address, 'Malahide Castle & Gardens, Back Road, Malahide, Co. Dublin');
assert.equal(eventCamps[0].booking_url, eventUrl);
assert.equal(eventCamps[0].source_url, eventUrl);
assert.equal(eventCamps[0].price, '€198');
assert.equal(eventCamps[0].age_min, 5);
assert.equal(eventCamps[0].age_max, 11);
assert.equal(eventCamps[0].holiday_type, 'Summer');
assert.equal(eventCamps[0].camp_name, 'Junior Einsteins Science Summer Camp');
assertCleanLocation(eventCamps[0]);

const duplicateDateText = `${eventText}
Source URL: https://junioreinsteinsscienceclub.com/events/glenageary-dublin-science-summer-camp-for-kids-monday-6th-july-to-friday-10th-july-9am-1pm-daily/
Glenageary Dublin Science Summer Camp for Kids Monday 6th July to Friday 10th July 9am 1pm daily`;
const twoEvents = extractDiscoveryRecords(input, duplicateDateText).camps;
assert.equal(twoEvents.length, 2);
assert.deepEqual(twoEvents.map((camp) => `${camp.start_date}:${camp.end_date}`), ['2026-06-29:2026-07-03', '2026-07-06:2026-07-10']);

function juniorPriorityDecision(source, link) {
  const parsed = new URL(link, source);
  return /junioreinsteinsscienceclub\.com$/i.test(source.hostname) && /science-camps-list-kids-childrens-camp\/?$/i.test(source.pathname)
    ? (/^\/events\/[^/]+\/?$/i.test(parsed.pathname) ? 'crawl' : 'skip')
    : 'skip';
}
const source = new URL(input.sourceUrl);
assert.equal(juniorPriorityDecision(source, eventUrl), 'crawl');
assert.equal(juniorPriorityDecision(source, 'https://junioreinsteinsscienceclub.com/wp-content/theme/app.js'), 'skip');
assert.equal(juniorPriorityDecision(source, 'https://junioreinsteinsscienceclub.com/testimonials/'), 'skip');
assert.equal(juniorPriorityDecision(source, 'https://junioreinsteinsscienceclub.com/about/'), 'skip');

const augustUrl = 'https://junioreinsteinsscienceclub.com/events/malahide-castle-gardens-dublin-science-summer-camp-for-kids-monday-4th-august-to-friday-7th-august-930am-130pm-daily/';
const augustText = `Source URL: ${augustUrl}
Malahide Castle Gardens Dublin Science Summer Camp for Kids Monday 4th August to Friday 7th August 930am 130pm daily
Date : 2026-08-10 - 2026-08-14
Cost €198
Suitable for 5 -11 years old`;
const augustCamp = extractDiscoveryRecords({ sourceUrl: augustUrl }, augustText).camps[0];
assert.equal(augustCamp.start_date, '2026-08-10');
assert.equal(augustCamp.end_date, '2026-08-14');


const rosemontUrl = 'https://junioreinsteinsscienceclub.com/events/summer-science-camp-for-kids-rosemont-school-dublin-18-monday-6th-to-friday-10th-july-9am-1pm-daily/';
const rosemontText = `Source URL: ${rosemontUrl}
Summer Science Camp for Kids Rosemont School Dublin 18 Monday 6th to Friday 10th July 9am-1pm daily
Address: Rosemont School, Enniskerry Road, Sandyford, Dublin 18 Dates & Times: Monday 29th June – Friday 3rd July 2026 (9am-1pm daily) Ages: 5 -12 year olds
Date:
Jul 06 2026 - Jul 10 2026
Time:
09:00 AM - 01:00 PM
Cost €198
Suitable for 5 -12 years old`;
const rosemontCamp = extractDiscoveryRecords({ sourceUrl: rosemontUrl }, rosemontText).camps[0];
assert.equal(rosemontCamp.address, 'Rosemont School, Enniskerry Road, Sandyford, Dublin 18');
assert.equal(rosemontCamp.town, 'Sandyford');
assert.equal(rosemontCamp.county, 'Dublin');
assert.equal(rosemontCamp.start_date, '2026-07-06');
assert.equal(rosemontCamp.end_date, '2026-07-10');
assert.equal(rosemontCamp.start_time, '09:00');
assert.equal(rosemontCamp.end_time, '13:00');
assert.equal(rosemontCamp.age_min, 5);
assert.equal(rosemontCamp.age_max, 12);
assertCleanLocation(rosemontCamp);

const claregalwayUrl = 'https://junioreinsteinsscienceclub.com/events/claregalway-educate-together-national-school-galway-science-summer-camp-for-kids-monday-10th-to-friday-14th-august-9am-1pm-daily/';
const claregalwayText = `Source URL: ${claregalwayUrl}
Claregalway Educate Together National School Galway Science Summer Camp
Address
Claregalway Educate Together National School, Lakeview, Claregalway, Co. Galway
Date : 2026-08-10 - 2026-08-14
Cost €198
This is an exclusive event for all children aged 5–12 in Claregalway`;
const claregalwayCamp = extractDiscoveryRecords({ sourceUrl: claregalwayUrl }, claregalwayText).camps[0];
assert.equal(claregalwayCamp.address, 'Claregalway Educate Together National School, Lakeview, Claregalway, Co. Galway');
assert.equal(claregalwayCamp.town, 'Claregalway');
assert.equal(claregalwayCamp.county, 'Galway');
assert.equal(claregalwayCamp.age_min, 5);
assert.equal(claregalwayCamp.age_max, 12);
assertCleanLocation(claregalwayCamp);


const glenagearyUrl = 'https://junioreinsteinsscienceclub.com/events/summer-science-camp-for-kids-glenageary-dublin-monday-6th-july-to-friday-10th-july-9am-1pm-daily/';
const glenagearyCamp = extractDiscoveryRecords({ sourceUrl: glenagearyUrl }, `Source URL: ${glenagearyUrl}
Summer Science Camp for Kids, Glenageary, Dublin – Monday 6th July to Friday 10th July
Date Jul 06 2026 - Jul 10 2026
Cost €198`).camps[0];
assert.equal(glenagearyCamp.town, 'Glenageary');
assert.equal(glenagearyCamp.county, 'Dublin');
assert.notEqual(glenagearyCamp.address, '');
assert.notEqual(glenagearyCamp.age_min, 0);
assert.notEqual(glenagearyCamp.age_max, 0);
assertCleanLocation(glenagearyCamp);
assert.equal([glenagearyCamp.town, glenagearyCamp.county].filter(Boolean).join(', '), 'Glenageary, Dublin');

const brayUrl = 'https://junioreinsteinsscienceclub.com/events/bray-wicklow-summer-science-camp-for-kids-monday-20th-to-friday-24th-july-9am-1pm-daily-at-festina-lente-equestrian-centre/';
const brayCamp = extractDiscoveryRecords({ sourceUrl: brayUrl }, `Source URL: ${brayUrl}
Bray, Wicklow – Summer Science Camp for kids – Monday 20th to Friday 24th July at Festina Lente Equestrian Centre
Date Jul 20 2026 - Jul 24 2026
Cost €198`).camps[0];
assert.equal(brayCamp.town, 'Bray');
assert.equal(brayCamp.county, 'Wicklow');
assert.equal(brayCamp.address, 'Festina Lente Equestrian Centre');
assertCleanLocation(brayCamp);

const leopardstownUrl = 'https://junioreinsteinsscienceclub.com/events/summer-science-camp-for-kids-nord-anglia-international-school-leopardstown-dublin-18-monday-13th-to-friday-17th-july-9am-1pm-daily/';
const leopardstownCamp = extractDiscoveryRecords({ sourceUrl: leopardstownUrl }, `Source URL: ${leopardstownUrl}
Summer Science Camp for Kids -Nord Anglia International School, Leopardstown, Dublin 18
Address: D18T672
Date Jul 13 2026 - Jul 17 2026
Cost €198`).camps[0];
assert.equal(leopardstownCamp.town, 'Leopardstown');
assert.equal(leopardstownCamp.county, 'Dublin');
assert.equal(leopardstownCamp.address, 'Nord Anglia International School, Leopardstown, Dublin 18');
assert.notEqual(leopardstownCamp.town, 'D18T672');
assert.notEqual(leopardstownCamp.address, 'D18T672');
assert.equal(leopardstownCamp.eircode, 'D18 T672');
assertCleanLocation(leopardstownCamp);


const nordAngliaPunctuationUrl = 'https://junioreinsteinsscienceclub.com/events/summer-science-camp-for-kids-nord-anglia-international-school-leopardstown-dublin-18-tuesday-4th-to-friday-7th-august-9am-1pm-daily/';
const nordAngliaPunctuationCamp = extractDiscoveryRecords({ sourceUrl: nordAngliaPunctuationUrl }, `Source URL: ${nordAngliaPunctuationUrl}
Summer Science Camp for Kids -Nord Anglia International School, Leopardstown, Dublin 18
Address: :
Date Aug 04 2026 - Aug 07 2026
Cost €198`).camps[0];
assert.equal(nordAngliaPunctuationCamp.town, 'Leopardstown');
assert.equal(nordAngliaPunctuationCamp.county, 'Dublin');
assert.equal(nordAngliaPunctuationCamp.address, 'Nord Anglia International School, Leopardstown, Dublin 18');
assert.notEqual(nordAngliaPunctuationCamp.town, ':');
assert.notEqual(nordAngliaPunctuationCamp.address, ':');
assertCleanLocation(nordAngliaPunctuationCamp);

const greystonesUrl = 'https://junioreinsteinsscienceclub.com/events/summer-science-camp-for-kids-greystones-wicklow-monday-13th-to-friday-17th-july-9am-1pm-daily/';
const greystonesCamp = extractDiscoveryRecords({ sourceUrl: greystonesUrl }, `Source URL: ${greystonesUrl}
Summer Science Camp for kids – Greystones, Wicklow
Address: St Patricks National School, Church Road, Rathdown Lower, Church Road, Greystones, Co. Wicklow
Date Jul 13 2026 - Jul 17 2026
Cost €198`).camps[0];
assert.equal(greystonesCamp.town, 'Greystones');
assert.equal(greystonesCamp.county, 'Wicklow');
assert.notEqual(greystonesCamp.county, 'Dublin');
assert.equal([greystonesCamp.town, greystonesCamp.county].filter(Boolean).join(', '), 'Greystones, Wicklow');
assert.notEqual(greystonesCamp.address, '');
assert.equal(greystonesCamp.age_min, 5);
assert.equal(greystonesCamp.age_max, 12);
assert.equal(greystonesCamp.needs_review, true);
assert.ok(greystonesCamp.extractionWarnings.includes('Age inferred from other Junior Einsteins summer camp listings'));
assertCleanLocation(greystonesCamp);



const tuamUrl = 'https://junioreinsteinsscienceclub.com/events/summer-science-camp-for-kids-family-resource-center-tuam-galway-monday-27th-to-friday-31st-july-9am-1pm-daily/';
const tuamCamp = extractDiscoveryRecords({ sourceUrl: tuamUrl }, `Source URL: ${tuamUrl}
Summer Science Camp for Kids Family Resource Center Tuam Galway
Date Jul 27 2026 - Jul 31 2026
Cost €198`).camps[0];
assert.equal(tuamCamp.address, 'Family Resource Center');
assert.equal(tuamCamp.town, 'Tuam');
assert.equal(tuamCamp.county, 'Galway');
assert.notEqual(tuamCamp.town, 'Galway');

const naasUrl = 'https://junioreinsteinsscienceclub.com/events/naas-kildare-science-summer-camp-for-children-at-naas-gaa-club-monday-10th-to-friday-14th-august-9am-1pm-daily/';
const naasCamp = extractDiscoveryRecords({ sourceUrl: naasUrl }, `Source URL: ${naasUrl}
Naas, Kildare Science Summer Camp for children at Naas GAA Club
Date Aug 10 2026 - Aug 14 2026
Cost €198`).camps[0];
assert.equal(naasCamp.address, 'Naas GAA Club');
assert.equal(naasCamp.town, 'Naas');
assert.equal(naasCamp.county, 'Kildare');
assert.equal(naasCamp.age_min, 5);
assert.equal(naasCamp.age_max, 12);
assert.ok(naasCamp.extractionWarnings.includes('Age inferred from other Junior Einsteins summer camp listings'));


const naasJulyUrl = 'https://junioreinsteinsscienceclub.com/events/naas-kildare-science-summer-camp-for-children-at-naas-gaa-club-monday-27th-to-friday-31st-july-9am-1pm-daily/';
const naasJulyCamp = extractDiscoveryRecords({ sourceUrl: naasJulyUrl }, `Source URL: ${naasJulyUrl}
Naas, Kildare Science Summer Camp for children at Naas GAA Club
Date Jul 27 2026 - Jul 31 2026
Cost €198`).camps[0];
assert.equal(naasJulyCamp.address, 'Naas GAA Club');
assert.equal(naasJulyCamp.town, 'Naas');
assert.equal(naasJulyCamp.county, 'Kildare');
assert.equal(naasJulyCamp.age_min, 5);
assert.equal(naasJulyCamp.age_max, 12);
assert.ok(naasJulyCamp.extractionWarnings.includes('Age inferred from other Junior Einsteins summer camp listings'));

const castleknockUrl = 'https://junioreinsteinsscienceclub.com/events/castleknock-dublin-science-summer-camp-for-kids-monday-6th-to-friday-10th-july-9am-1pm-daily/';
const castleknockCamp = extractDiscoveryRecords({ sourceUrl: castleknockUrl }, `Source URL: ${castleknockUrl}
Castleknock, Dublin – Science Summer Camp for kids
Address: Castleknock, Dublin D15 DK54 Dates & Times: Monday 6th to Friday 10th July (9am-1pm daily)
Date Jul 06 2026 - Jul 10 2026
Cost €198`).camps[0];
assert.equal(castleknockCamp.town, 'Castleknock');
assert.equal(castleknockCamp.county, 'Dublin');
assert.notEqual(castleknockCamp.town, 'D15 DK54');
assert.notEqual(castleknockCamp.address, 'D15 DK54');
assertCleanLocation(castleknockCamp);

const maynoothUrl = 'https://junioreinsteinsscienceclub.com/events/maynooth-kildare-science-summer-camp-for-children-at-maynooth-university-monday-6th-july-to-friday-10th-july-9am-1pm-daily/';
const maynoothCamp = extractDiscoveryRecords({ sourceUrl: maynoothUrl }, `Source URL: ${maynoothUrl}
Maynooth, Kildare – Science Summer Camp for children at Maynooth University
Address: Maynooth University, Maynooth, Kildare Dates & Times: Monday 6th July - Friday 10th July; 9am -1pm daily Ages
Date Jul 06 2026 - Jul 10 2026
Cost €198`).camps[0];
assert.equal(maynoothCamp.town, 'Maynooth');
assert.equal(maynoothCamp.county, 'Kildare');
assert.equal(maynoothCamp.address, 'Maynooth University, Maynooth, Kildare');
assertCleanLocation(maynoothCamp);

const celbridgeUrl = 'https://junioreinsteinsscienceclub.com/events/celbridge-kildare-science-summer-camp-for-kids-at-scoil-na-mainistreach-monday-13th-to-friday-17th-july-9am-1pm-daily/';
const celbridgeCamp = extractDiscoveryRecords({ sourceUrl: celbridgeUrl }, `Source URL: ${celbridgeUrl}
Celbridge, Kildare Science Summer Camp at Scoil na Mainistreach
Date Jul 13 2026 - Jul 17 2026
Cost €198`).camps[0];
assert.equal(celbridgeCamp.town, 'Celbridge');
assert.equal(celbridgeCamp.county, 'Kildare');
assert.equal(celbridgeCamp.address, 'Scoil na Mainistreach, Celbridge');

const knocklyonUrl = 'https://junioreinsteinsscienceclub.com/events/knocklyon-dublin-science-summer-camp-for-kids-monday-13th-to-friday-17th-july-9am-1pm-daily/';
const knocklyonCamp = extractDiscoveryRecords({ sourceUrl: knocklyonUrl }, `Source URL: ${knocklyonUrl}
Knocklyon, Dublin Science Summer Camp
Date Jul 13 2026 - Jul 17 2026
Cost €198`).camps[0];
assert.equal(knocklyonCamp.town, 'Knocklyon');
assert.equal(knocklyonCamp.county, 'Dublin');
assertCleanLocation(knocklyonCamp);


const halloweenUrl = 'https://junioreinsteinsscienceclub.com/events/greystones-wicklow-science-halloween-camp-for-kids-monday-26th-to-friday-30th-october-9am-1pm-daily/';
const halloweenCamp = extractDiscoveryRecords({ sourceUrl: halloweenUrl }, `Source URL: ${halloweenUrl}
Greystones, Wicklow Science Halloween Camp
Date Oct 26 2026 - Oct 30 2026
Cost €198`).camps[0];
assert.equal(halloweenCamp.holiday_type, 'Halloween');
assert.equal(halloweenCamp.age_min, '');
assert.equal(halloweenCamp.age_max, '');
assert.ok(!halloweenCamp.extractionWarnings.includes('Age inferred from other Junior Einsteins summer camp listings'));

const medicsUrl = 'https://junioreinsteinsscienceclub.com/events/junior-medics-science-camp-galway/';
const medicsCamps = extractDiscoveryRecords({ sourceUrl: medicsUrl }, `Source URL: ${medicsUrl}
Junior Medics Science camp Galway
Date Jul 13 2026 - Jul 13 2026`).camps;
assert.equal(medicsCamps.length, 0);
const astronautsUrl = 'https://junioreinsteinsscienceclub.com/events/junior-astronauts-science-camp-galway/';
const astronautsCamps = extractDiscoveryRecords({ sourceUrl: astronautsUrl }, `Source URL: ${astronautsUrl}
Junior Astronauts Science camp Galway
Date Jul 13 2026 - Jul 13 2026`).camps;
assert.equal(astronautsCamps.length, 0);

for (const camp of [eventCamps[0], rosemontCamp, claregalwayCamp, glenagearyCamp, brayCamp, leopardstownCamp, nordAngliaPunctuationCamp, greystonesCamp, tuamCamp, naasCamp, naasJulyCamp, castleknockCamp, maynoothCamp, celbridgeCamp, knocklyonCamp]) {
  assert.equal(/^[A-Z]\d{2}\s?[A-Z0-9]{4}$/i.test(String(camp.town)), false);
  assert.equal(/^[A-Z]\d{2}\s?[A-Z0-9]{4}$/i.test(String(camp.address)), false);
  assert.notEqual(camp.age_min, 0);
  assert.notEqual(camp.age_max, 0);
}
assert.deepEqual(uniqueOptions([':', ' ', 'D18 T672', 'Glenageary', 'Greystones', '-', 'Naas']), ['Glenageary', 'Greystones', 'Naas']);
console.log('Junior Einsteins tests passed');
