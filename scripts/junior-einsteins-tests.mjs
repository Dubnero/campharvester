import assert from 'node:assert/strict';
import { extractDiscoveryRecords } from '../lib/discoveryUtils.ts';

const input = { sourceUrl: 'https://junioreinsteinsscienceclub.com/science-camps-list-kids-childrens-camp/' };

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

const eventUrl = 'https://junioreinsteinsscienceclub.com/events/malahide-castle-gardens-dublin-science-summer-camp-for-kids-monday-29th-june-to-friday-3rd-july-930am-130pm-daily/';
const eventText = `Source URL: ${input.sourceUrl}
Junior Einsteins Science Club
Science Camps List
Jun 29 2026 - Jul 03 2026
Book now
Source URL: ${eventUrl}
Malahide Castle Gardens Dublin Science Summer Camp for Kids Monday 29th June to Friday 3rd July 930am 130pm daily
Address: Malahide Castle & Gardens, Back Road, Malahide, Co. Dublin
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
Address: Rosemont School, Enniskerry Road, Sandyford, Dublin 18
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

const claregalwayUrl = 'https://junioreinsteinsscienceclub.com/events/claregalway-educate-together-national-school-galway-science-summer-camp-for-kids-monday-10th-to-friday-14th-august-9am-1pm-daily/';
const claregalwayText = `Source URL: ${claregalwayUrl}
Claregalway Educate Together National School Galway Science Summer Camp
Address
Claregalway Educate Together National School, Lakeview, Claregalway, Co. Galway
Date : 2026-08-10 - 2026-08-14
Cost €198
Suitable for 5 -11 years old`;
const claregalwayCamp = extractDiscoveryRecords({ sourceUrl: claregalwayUrl }, claregalwayText).camps[0];
assert.equal(claregalwayCamp.address, 'Claregalway Educate Together National School, Lakeview, Claregalway, Co. Galway');
assert.equal(claregalwayCamp.town, 'Claregalway');
assert.equal(claregalwayCamp.county, 'Galway');

console.log('Junior Einsteins tests passed');
