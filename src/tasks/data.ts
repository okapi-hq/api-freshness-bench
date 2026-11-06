import type { Task } from '../types.ts';
import { current, deprecated, fails, invalid } from '../kb/facts.ts';
import { required, rule, slot } from '../kb/rule.ts';

const BING = 'https://learn.microsoft.com/en-us/lifecycle/announcements/bing-search-api-retirement';
const CSE = 'https://developers.google.com/custom-search/v1/overview';
const OWM_CURRENT = 'https://openweathermap.org/api/current';
const OWM_ONECALL = 'https://openweathermap.org/api/one-call-api';
const OPENAQ = 'https://docs.openaq.org/about/about';
const GA_V4 = 'https://developers.google.com/analytics/devguides/reporting/core/v4';
const GA_DATA = 'https://developers.google.com/analytics/devguides/reporting/data/v1';
const USPS = 'https://www.usps.com/business/web-tools-apis/welcome.htm';
const GRAPH_ALERTS = 'https://learn.microsoft.com/en-us/graph/api/alert-list?view=graph-rest-1.0';
const ADAL = 'https://learn.microsoft.com/en-us/entra/identity-platform/msal-migration';
const HUBSPOT_KEYS = 'https://developers.hubspot.com/changelog/upcoming-api-key-sunset';
const HUBSPOT_LEGACY = 'https://developers.hubspot.com/changelog/legacy-apis-and-legacy-apps-whats-going-unsupported-and-when';
const GSI = 'https://developers.google.com/identity/sign-in/web/deprecation-and-sunset';

export const DATA_TASKS: Task[] = [
  {
    id: 'web-search-py',
    title: 'A web search tool for an agent',
    category: 'data',
    provider: 'Web search APIs',
    language: 'python',
    style: 'rest',
    prompt: 'Add a web search tool to my Python agent: a function that takes a query and returns the top 5 results (title, URL, snippet) from a web search API.',
    evidence: "Agents need a search API, and two common ones are gone: Microsoft retired the Bing Search APIs on 2025-08-11, and Google closed its Custom Search JSON API to new customers.",
    slots: [
      required('provider', 'Search provider', [
        rule(
          'bing-v7',
          'Bing Web Search API v7',
          'api\\.bing\\.microsoft\\.com|/bing/v7\\.0|cognitiveservices/v1\\.0/search',
          fails('2025-08-11', '2025-05-15', BING, {
            quote: 'Bing Search APIs will be retired on August 11, 2025. Any existing instances of Bing Search APIs will be decommissioned completely',
            note: 'Microsoft points to Grounding with Bing Search in Azure AI Agents.',
          }),
        ),
        rule(
          'google-cse',
          'Google Custom Search JSON API',
          'customsearch/v1|customsearch\\.googleapis|build\\(\\s*["\']customsearch',
          fails('2027-01-01', undefined, CSE, {
            origin: 'provider',
            quote: 'The Custom Search JSON API is closed to new customers.',
            note: 'Existing customers have until January 1, 2027 to move to an alternative.',
          }),
        ),
        rule(
          'duckduckgo-search',
          'duckduckgo_search (renamed ddgs, unofficial scraping)',
          'duckduckgo_search|duckduckgo-search',
          deprecated('2025-07-06', 'https://pypi.org/project/duckduckgo-search/', {
            origin: 'registry',
            note: 'Last release 8.1.1 on 2025-07-06; the project continues as ddgs. It scrapes DuckDuckGo rather than calling an API.',
          }),
        ),
        rule('brave', 'Brave Search API', 'api\\.search\\.brave\\.com', current('https://api-dashboard.search.brave.com/app/documentation')),
        rule('tavily', 'Tavily', 'api\\.tavily\\.com|tavily', current('https://docs.tavily.com')),
        rule('serper', 'Serper', 'google\\.serper\\.dev', current('https://serper.dev')),
        rule('serpapi', 'SerpApi', 'serpapi\\.com|serpapi', current('https://serpapi.com')),
        rule('exa', 'Exa', 'api\\.exa\\.ai|exa_py|from exa', current('https://docs.exa.ai')),
        rule('ddgs', 'ddgs', '(?<![\\w])ddgs(?![\\w])', current('https://pypi.org/project/ddgs/')),
      ]),
    ],
  },
  {
    id: 'openweather-forecast-py',
    title: 'Current weather and forecast for a city',
    category: 'data',
    provider: 'OpenWeather',
    language: 'python',
    style: 'rest',
    prompt: 'Write a Python function that returns the current temperature and a 3-day forecast for a city name using the OpenWeatherMap API.',
    evidence: "OpenWeather deprecated city-name lookups (q= on /data/2.5) in favor of its Geocoding API, and deprecated One Call 2.5 in June 2024.",
    slots: [
      required('lookup', 'Location lookup and endpoint', [
        rule(
          'onecall-25',
          'One Call API 2.5',
          'data/2\\.5/onecall',
          deprecated('2024-06-01', OWM_ONECALL, { quote: 'The One Call API, endpoint version 2.5, has been deprecated as of June 2024.' }),
        ),
        rule(
          'city-name-query',
          'q=<city> on /data/2.5 (built-in geocoder)',
          'data/2\\.5/(?:weather|forecast)[^\\n]*(?:[?&]q=|["\']q["\']\\s*:)',
          deprecated(undefined, OWM_CURRENT, { quote: 'Please note that API requests by city name, zip-codes and city id have been deprecated.' }),
        ),
        // A `q` parameter is the Geocoding API's own when the answer geocodes first.
        rule(
          'city-name-params',
          'q=<city> on /data/2.5 (built-in geocoder)',
          '["\']q["\']\\s*:[^\\n]*(?:city|name)',
          deprecated(undefined, OWM_CURRENT, { quote: 'Please note that API requests by city name, zip-codes and city id have been deprecated.' }),
          { unless: ['lookup.geocoding'] },
        ),
        // The same query as a keyword argument, passed on to the request (`fetch("weather", q=city)`).
        rule(
          'city-name-kwarg',
          'q=<city> on /data/2.5 (built-in geocoder)',
          '(?<![\\w.])q\\s*=\\s*(?:city|city_name|name|location|query|args\\.\\w+)\\b',
          deprecated(undefined, OWM_CURRENT, { quote: 'Please note that API requests by city name, zip-codes and city id have been deprecated.' }),
          { unless: ['lookup.geocoding'] },
        ),
        rule('geocoding', 'Geocoding API, then lat/lon', 'geo/1\\.0/direct', current(OWM_CURRENT)),
      ]),
    ],
  },
  {
    id: 'openaq-pm25-js',
    title: 'Latest PM2.5 for a city with OpenAQ',
    category: 'data',
    provider: 'OpenAQ',
    language: 'javascript',
    style: 'rest',
    prompt: 'Write a Node.js function that returns the latest PM2.5 measurements for a city from the OpenAQ API.',
    evidence: "OpenAQ retired its v1 and v2 APIs on 2025-01-31; they now answer 410 Gone.",
    slots: [
      required('version', 'API version', [
        rule(
          'v1-v2',
          'OpenAQ v1/v2',
          'api\\.openaq\\.org/v[12](?![\\d])',
          fails('2025-01-31', undefined, OPENAQ, { quote: 'The OpenAQ version 1 and version 2 endpoints were retired on January 31, 2025 and are no longer accessible.' }),
        ),
        rule('v3', 'OpenAQ v3', 'api\\.openaq\\.org/v3(?![\\d])', current(OPENAQ)),
      ]),
    ],
  },
  {
    id: 'ga-pageviews-py',
    title: 'Last week\'s page views from Google Analytics',
    category: 'marketing',
    provider: 'Google Analytics',
    language: 'python',
    style: 'sdk',
    prompt: "Write a Python script that pulls last week's page views per page path from Google Analytics and prints the top 20.",
    evidence: "A control task: Universal Analytics, with its Reporting API v4 and Core Reporting v3, stopped on 2024-07-01.",
    slots: [
      required('api', 'Reporting API', [
        rule(
          'ua-reporting-v4',
          'Analytics Reporting API v4 (Universal Analytics)',
          'analyticsreporting|reports\\(\\)\\.batchGet|ga:pageviews|ga:pagePath',
          fails('2024-07-01', '2022-03-16', GA_V4, { quote: 'Universal Analytics has sunset and is no longer available as of July 1, 2024.' }),
        ),
        rule(
          'ua-core-v3',
          'Core Reporting API v3',
          'analytics/v3/data|\\.data\\(\\)\\.ga\\(\\)',
          fails('2024-07-01', '2022-03-16', 'https://developers.google.com/analytics/devguides/reporting/core/v3', {}),
        ),
        rule('ga4-data', 'Google Analytics Data API (GA4)', 'analyticsdata|BetaAnalyticsDataClient|RunReportRequest|run_report', current(GA_DATA)),
      ]),
    ],
  },
  {
    id: 'usps-rates-py',
    title: 'USPS shipping rates for a package',
    category: 'shipping',
    provider: 'USPS',
    language: 'python',
    style: 'rest',
    prompt: 'Write a Python function that returns USPS shipping rates (Priority Mail and Ground Advantage) for a package given origin and destination ZIP codes and its weight.',
    evidence: "USPS retired its Web Tools API platform on 2026-01-25.",
    slots: [
      required('api', 'USPS API', [
        rule(
          'web-tools',
          'USPS Web Tools (ShippingAPI.dll, XML)',
          'shippingapis\\.com|ShippingAPI\\.dll|RateV4Request|IntlRateV2',
          fails('2026-01-25', undefined, USPS, {
            quote: 'The USPS Web Tools API platform was retired on January 25, 2026 and service disruptions are underway.',
            note: 'Move to the USPS APIs on apis.usps.com (OAuth 2.0).',
          }),
        ),
        rule('usps-apis', 'USPS APIs (apis.usps.com)', 'apis(?:-tem)?\\.usps\\.com|//api\\.usps\\.com', current(USPS, { note: 'api.usps.com answers like apis.usps.com (checked 2026-10-24).' })),
      ]),
    ],
  },
  {
    id: 'msgraph-alerts-py',
    title: 'High-severity security alerts from Microsoft Graph',
    category: 'cloud',
    provider: 'Microsoft Graph',
    language: 'python',
    style: 'rest',
    prompt: 'Write a Python script that lists the high-severity security alerts of my Microsoft 365 tenant from the Microsoft Graph API, authenticating as an app with a client secret.',
    evidence: "Microsoft retired the legacy Microsoft Graph security alerts API on 2026-10-15; alerts_v2 replaces it.",
    slots: [
      required('endpoint', 'Alerts endpoint', [
        rule(
          'alerts-legacy',
          'GET /security/alerts (legacy)',
          'security[/.]alerts(?!_v2)(?![\\w])',
          fails('2026-10-15', '2024-04-15', GRAPH_ALERTS, { quote: 'The legacy alerts API is deprecated and will be retired on October 15, 2026.' }),
        ),
        // A URL path, or the SDKs' request builders (client.security.alerts_v2).
        rule('alerts-v2', 'GET /security/alerts_v2', 'security[/.]alerts_v2', current(GRAPH_ALERTS)),
        rule(
          'security-alerts-invented',
          'GET /security/securityAlerts (no such endpoint)',
          'security/securityAlerts',
          invalid(GRAPH_ALERTS, { origin: 'provider', note: 'Microsoft Graph has /security/alerts (retired) and /security/alerts_v2, not securityAlerts.' }),
        ),
      ]),
      slot('auth', 'Auth library', [
        rule('adal', 'ADAL (adal)', '(?:^|\\n)\\s*(?:import adal|from adal import)', deprecated('2020-06-30', ADAL, { origin: 'provider', note: 'ADAL support ended on June 30, 2023; use MSAL.' })),
        rule('msal', 'MSAL', 'import msal|from msal import|ClientSecretCredential', current(ADAL)),
      ]),
    ],
  },
  {
    id: 'hubspot-contact-py',
    title: 'Create a contact in HubSpot',
    category: 'marketing',
    provider: 'HubSpot',
    language: 'python',
    style: 'rest',
    prompt: 'Write a Python function that creates or updates a contact (email, first name, last name, company) in HubSpot with the requests library.',
    evidence: "HubSpot moved its numbered /v1 to /v3 APIs to unsupported in 2026 for date-based versions; API keys (hapikey) stopped on 2022-11-30.",
    slots: [
      required('auth', 'Authentication', [
        rule(
          'hapikey',
          'hapikey query parameter (API keys)',
          'hapikey',
          fails('2022-11-30', '2022-06-01', HUBSPOT_KEYS, { origin: 'provider', note: 'Use a private app access token in the Authorization header.' }),
        ),
        rule('bearer', 'private app token (Bearer)', 'Bearer', current(HUBSPOT_KEYS)),
      ]),
      slot('version', 'API version', [
        rule('v1-contacts', '/contacts/v1', '/contacts/v1/', deprecated('2026-09-15', HUBSPOT_LEGACY, { quote: 'Endpoints using numbered version paths, /v1/ , /v2/ , and /v3/ , will move to unsupported status.' })),
        rule('v3-crm', '/crm/v3', '/crm/v3/', deprecated('2026-09-15', HUBSPOT_LEGACY, { quote: 'Endpoints using numbered version paths, /v1/ , /v2/ , and /v3/ , will move to unsupported status.' })),
        rule('date-based', '/crm/objects/2026-09 (date-based)', '/crm/(?:objects/)?\\d{4}-\\d{2}/', current(HUBSPOT_LEGACY)),
      ]),
    ],
  },
  {
    id: 'google-signin-html',
    title: 'Sign in with Google on a plain website',
    category: 'identity',
    provider: 'Google Identity',
    language: 'html',
    style: 'sdk',
    prompt: 'Add a "Sign in with Google" button to my plain HTML/JavaScript website and send the signed-in user\'s ID token to my backend at /auth/google.',
    evidence: "A control task: Google's Sign-In platform library (platform.js, gapi.auth2) is deprecated and refuses new client IDs; Google Identity Services replaced it.",
    slots: [
      required('library', 'Google sign-in library', [
        rule(
          'platform-js',
          'Google Sign-In platform library (platform.js, gapi.auth2)',
          'apis\\.google\\.com/js/platform\\.js|gapi\\.auth2|g-signin2|onSignIn\\s*\\(\\s*googleUser',
          fails('2022-07-29', undefined, GSI, {
            origin: 'provider',
            quote: 'New OAuth Client IDs cannot use the deprecated library,',
            note: 'Support for the library is deprecated as of March 31, 2023; use Google Identity Services.',
          }),
        ),
        rule('gis', 'Google Identity Services (accounts.google.com/gsi/client)', 'accounts\\.google\\.com/gsi/client|google\\.accounts\\.id', current(GSI)),
      ]),
    ],
  },
];
