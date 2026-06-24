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
Malahide Castle Gardens Dublin Science Summer Camp for Kids Monday 29th June to Friday 3rd July 930am 130pm daily`;
const eventCamps = extractDiscoveryRecords(input, eventText).camps;
assert.equal(eventCamps.length, 1);
assert.equal(eventCamps[0].start_date, '2026-06-29');
assert.equal(eventCamps[0].end_date, '2026-07-03');
assert.equal(eventCamps[0].start_time, '09:30');
assert.equal(eventCamps[0].end_time, '13:30');
assert.equal(eventCamps[0].town, 'Malahide');
assert.equal(eventCamps[0].county, 'Dublin');
assert.equal(eventCamps[0].address, 'Malahide Castle & Gardens');
assert.equal(eventCamps[0].booking_url, eventUrl);
assert.equal(eventCamps[0].source_url, eventUrl);

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
console.log('Junior Einsteins tests passed');
