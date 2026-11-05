import type { Rule } from '../types.ts';
import { current, fails, invalid, redirected } from './facts.ts';
import { addDays, BENCH_DATE } from '../grader/status.ts';

/** Version calendars: Meta's Graph API and LinkedIn's monthly API versions. */

const GRAPH_VERSIONS = 'https://developers.facebook.com/docs/graph-api/changelog/versions?locale=en_US';

/** Graph API versions and the day Meta starts answering them from a newer one (Okapi's calendar). */
const GRAPH: [string, string | null][] = [
  ['12.0', '2024-02-08'], ['13.0', '2024-05-28'], ['14.0', '2024-09-17'], ['15.0', '2024-11-20'],
  ['16.0', '2025-05-14'], ['17.0', '2025-09-12'], ['18.0', '2026-01-26'], ['19.0', '2026-05-21'],
  ['20.0', '2026-09-24'], ['21.0', '2027-01-21'], ['22.0', '2027-05-20'], ['23.0', '2027-10-08'],
  ['24.0', '2028-02-18'], ['25.0', '2028-07-29'], ['26.0', null],
];

/** Meta keeps a version for two years: its end day is known from the version after it. */
export function graphVersionRules(): Rule[] {
  const rules: Rule[] = GRAPH.map(([v, day]) => ({
    id: `v${v}`,
    label: `Graph API v${v}`,
    pattern: `(?:graph\\.(?:facebook|instagram)\\.com/|["'\`/])v${v.replace('.', '\\.')}(?=[/"'\`\\s,)]|$)`,
    flags: 'm',
    fact: day
      ? redirected(day, addDays(day, -730), GRAPH_VERSIONS, {
          note: 'Past this day Meta answers with the oldest version still available.',
        })
      : current(GRAPH_VERSIONS, { released: '2026-07-29' }),
  }));
  rules.push({
    id: 'older',
    label: 'Graph API v2 to v11',
    pattern: `(?:graph\\.(?:facebook|instagram)\\.com/|["'\`/])v(?:[2-9]|1[01])\\.\\d+(?=[/"'\`\\s,)]|$)`,
    flags: 'm',
    fact: redirected('2023-09-14', undefined, GRAPH_VERSIONS),
  });
  return rules;
}

const SHOPIFY_VERSIONING = 'https://shopify.dev/docs/api/usage/versioning';

/**
 * Shopify Admin API versions (`2025-07`): quarterly, each served for twelve
 * months, then answered from the oldest supported one (2025-07 is answered from a
 * newer version since 2026-07-16).
 */
export function shopifyVersionRules(): Rule[] {
  const rules: Rule[] = [];
  for (let y = 2021; y <= 2026; y++) {
    for (const m of ['01', '04', '07', '10']) {
      const v = `${y}-${m}`;
      const released = `${v}-01`;
      if (released > BENCH_DATE) break;
      const redirect = `${y + 1}-${m}-16`;
      rules.push({
        id: `shopify-${v}`,
        label: `Shopify Admin API ${v}`,
        flags: 'i',
        pattern: `admin/api/${v}(?![\\d-])|version[^\\n]{0,60}["'\`]${v}["'\`]|version\\s*=\\s*${v}(?![\\d-])|ApiVersion\\.${m === '01' ? 'January' : m === '04' ? 'April' : m === '07' ? 'July' : 'October'}${String(y).slice(2)}`,
        fact: redirected(redirect, released, SHOPIFY_VERSIONING, {
          origin: 'provider',
          note: 'Past its twelve months Shopify answers from the oldest supported version.',
        }),
      });
    }
  }
  return rules;
}

const SHOPIFY_API_PKG = 'https://www.npmjs.com/package/@shopify/shopify-api';

/**
 * `apiVersion: LATEST_API_VERSION` from @shopify/shopify-api: 2025-07 in 11.14.1, the last 11.x;
 * no longer exported from 12.0.0 on (read from the package files, 2026-10-25).
 */
export function shopifyLatestConstant(): Rule {
  return {
    id: 'latest-constant',
    label: 'LATEST_API_VERSION (@shopify/shopify-api)',
    pattern: '(?<![\\w$])LATEST_API_VERSION(?![\\w$])',
    sdk: {
      pkg: '@shopify/shopify-api',
      breaksFrom: 12,
      pinned: redirected('2026-07-16', '2025-07-01', SHOPIFY_VERSIONING, {
        origin: 'registry',
        note: 'Pinned below 12, the SDK sends 2025-07 (its last 11.x, 11.14.1), which Shopify answers from a newer version.',
      }),
    },
    fact: invalid(SHOPIFY_API_PKG, {
      origin: 'registry',
      note: '@shopify/shopify-api 12 and later no longer export LATEST_API_VERSION: the import is undefined and the client gets no API version.',
    }),
  };
}

const LINKEDIN_VERSIONING = 'https://learn.microsoft.com/en-us/linkedin/marketing/versioning';

/** LinkedIn-Version YYYYMM: each monthly version is served for one year. */
export function linkedinVersionRules(): Rule[] {
  const rules: Rule[] = [];
  for (let y = 2023; y <= 2026; y++) {
    for (let m = 1; m <= 12; m++) {
      const v = `${y}${String(m).padStart(2, '0')}`;
      const released = `${y}-${String(m).padStart(2, '0')}-15`;
      if (released > BENCH_DATE) break;
      const sunset = `${y + 1}-${String(m).padStart(2, '0')}-15`;
      rules.push({
        id: `li-${v}`,
        label: `LinkedIn-Version ${v}`,
        pattern: `linkedin-version["']?\\s*[:,=]\\s*["'\`]?${v}|version[^\\n]{0,60}["'\`]${v}["'\`]|version\\s*=\\s*${v}(?!\\d)`,
        flags: 'i',
        fact: fails(sunset, released, LINKEDIN_VERSIONING, {
          origin: 'provider',
          quote: 'These API versions are supported and stable for a minimum of one year before sunset.',
          note: 'A sunset version gets an error response; 202511 sunsets on 2026-11-16 (checked 2026-10-24).',
        }),
      });
    }
  }
  return rules;
}
