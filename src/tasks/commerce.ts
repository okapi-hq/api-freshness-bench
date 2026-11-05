import type { Task } from '../types.ts';
import { current, deprecated, fails, invalid } from '../kb/facts.ts';
import { required, rule, slot } from '../kb/rule.ts';
import { shopifyLatestConstant, shopifyVersionRules } from '../kb/versions.ts';

const STRIPE_CLOVER = 'https://docs.stripe.com/changelog/clover/2025-09-30/remove-redirect-to-checkout';
const STRIPE_SOURCES = 'https://docs.stripe.com/sources';
const PAYPAL_V1 = 'https://developer.paypal.com/api/deprecated/payments/v1/';
const PAYPAL_NPM = 'https://www.npmjs.com/package/@paypal/paypal-server-sdk';
const SHOPIFY_REST = 'https://shopify.dev/docs/api/admin-rest';
const COINBASE_KEYS = 'https://docs.cdp.coinbase.com/coinbase-app/authentication-authorization/legacy-keys';
const ETHERSCAN_V2 = 'https://kb.etherscan.com/etherscan-api-v1-will-be-fully-deprecated-by-15th-august-2025';
const JUP_CHANGELOG = 'https://developers.jup.ag/changelog/2025-08';
const JUP_MIGRATION = 'https://developers.jup.ag/docs/portal/migration';
const FRANKFURTER = 'https://raw.githubusercontent.com/lineofflight/frankfurter/main/CHANGELOG.md';

const npmDeprecated = (pkg: string) =>
  deprecated(undefined, `https://registry.npmjs.org/${pkg}`, {
    origin: 'registry',
    quote: 'Package no longer supported. The author suggests using the @paypal/paypal-server-sdk package instead',
  });

export const COMMERCE_TASKS: Task[] = [
  {
    id: 'stripe-checkout-react',
    title: 'One-time payment with Stripe Checkout',
    category: 'payments',
    provider: 'Stripe',
    language: 'typescript',
    style: 'sdk',
    prompt:
      'Add a "Buy now" button to my React + Express app that takes a one-time payment of $20 with Stripe Checkout and shows a success page.',
    evidence: "Stripe.js removed redirectToCheckout in its 2025-09-30 release, and the Sources API is deprecated.",
    slots: [
      slot('checkout', 'Checkout redirect', [
        rule('stripe-js-npm', '@stripe/stripe-js', '@stripe/stripe-js', current('https://github.com/stripe/stripe-js'), { scope: 'manifest' }),
        rule(
          'redirect-to-checkout',
          'stripe.redirectToCheckout',
          'redirectToCheckout\\s*\\(',
          invalid(STRIPE_CLOVER, {
            quote: 'The stripe.redirectToCheckout method is no longer supported in Stripe.js.',
            announced: '2025-09-30',
            note: 'Redirect to the Checkout Session URL instead (window.location.href = session.url).',
          }),
          { sdk: { pkg: '@stripe/stripe-js', breaksFrom: 8, pinned: deprecated('2025-09-30', STRIPE_CLOVER) } },
        ),
        rule('session-url', 'redirect to session.url', 'session\\.url|\\.url\\s*\\)|redirect\\(\\s*303', current(STRIPE_CLOVER)),
        rule(
          'sources-api',
          'Sources API (stripe.sources, /v1/sources)',
          '\\.sources\\.create\\s*\\(|/v1/sources|createSource\\s*\\(',
          deprecated(undefined, STRIPE_SOURCES, {
            quote: 'We’ve deprecated the Sources API and plan to remove support.',
          }),
        ),
      ]),
    ],
  },
  {
    id: 'paypal-orders-node',
    title: 'Create and capture a PayPal order',
    category: 'payments',
    provider: 'PayPal',
    language: 'javascript',
    style: 'sdk',
    prompt:
      'Write the server side of a PayPal checkout in Node.js with Express: an endpoint that creates an order for the cart total and an endpoint that captures it after the buyer approves.',
    evidence: "PayPal v1 payments are deprecated, and npm marks paypal-rest-sdk and @paypal/checkout-server-sdk as no longer supported.",
    slots: [
      required('api', 'PayPal API and SDK', [
        rule('paypal-rest-sdk', 'paypal-rest-sdk (npm: no longer supported)', 'paypal-rest-sdk', npmDeprecated('paypal-rest-sdk')),
        rule('checkout-server-sdk', '@paypal/checkout-server-sdk (npm: no longer supported)', '@paypal/checkout-server-sdk', npmDeprecated('@paypal/checkout-server-sdk')),
        rule(
          'v1-payments',
          '/v1/payments (Payments v1)',
          '/v1/payments/(?:payment|sale|authorization)|payment\\.create\\s*\\(',
          deprecated(undefined, PAYPAL_V1, { quote: 'Deprecation notice: The /v1/payments endpoint is deprecated.' }),
        ),
        rule('v2-orders', '/v2/checkout/orders (Orders v2)', '/v2/checkout/orders|OrdersCreateRequest|ordersController|createOrder\\s*\\(', current(PAYPAL_V1)),
        rule('server-sdk', '@paypal/paypal-server-sdk', '@paypal/paypal-server-sdk', current(PAYPAL_NPM)),
      ]),
    ],
  },
  {
    id: 'shopify-products-node',
    title: 'List Shopify products with inventory',
    category: 'commerce',
    provider: 'Shopify',
    language: 'javascript',
    style: 'rest',
    prompt: 'Write a Node.js script that lists every product of my Shopify store with its variants and inventory quantities, using the Admin API with an access token.',
    evidence: "Shopify serves each quarterly Admin API version for a year, then answers it from a newer one (2025-07 already is). The REST Admin API has been legacy since October 2024.",
    slots: [
      required('version', 'Admin API version', [...shopifyVersionRules(), shopifyLatestConstant()]),
      slot('api', 'REST or GraphQL', [
        rule(
          'rest-admin',
          'REST Admin API (products.json)',
          'admin/api/[\\d-]+/(?:products|variants|inventory_levels)[^"\'`\\s]*\\.json',
          deprecated('2024-10-01', SHOPIFY_REST, {
            origin: 'provider',
            note: 'The REST Admin API is legacy since 2024-10-01; new public apps must use GraphQL since 2025-04-01.',
          }),
        ),
        rule('graphql-admin', 'GraphQL Admin API', 'graphql\\.json', current(SHOPIFY_REST)),
      ]),
    ],
  },
  {
    id: 'coinbase-balances-py',
    title: 'Coinbase account balances',
    category: 'crypto',
    provider: 'Coinbase',
    language: 'python',
    style: 'sdk',
    prompt: 'Write a Python script that prints the balance of each of my Coinbase accounts using the Coinbase API and my API key.',
    evidence: "Coinbase expired its legacy API keys, the HMAC-signed /v2 calls, in February 2025; current calls use CDP API keys.",
    slots: [
      required('auth', 'API and authentication', [
        rule(
          'legacy-hmac',
          'legacy API key HMAC signature (CB-ACCESS-SIGN)',
          'CB-ACCESS-SIGN|CB-ACCESS-KEY|from coinbase\\.wallet|coinbase\\.wallet\\.client',
          fails('2025-02-05', '2025-01-22', COINBASE_KEYS, {
            quote: 'In February, 2025, we expired all legacy API keys. Create new CDP API keys and update your code to continue using Coinbase App APIs.',
          }),
        ),
        rule('cdp-sdk', 'Coinbase Advanced / CDP key (JWT)', 'from coinbase\\.rest import|RESTClient\\s*\\(|ES256|cdp_api_key|build_jwt', current(COINBASE_KEYS)),
      ]),
    ],
  },
  {
    id: 'etherscan-balance-php',
    title: 'Ethereum balance and transactions with Etherscan, in PHP',
    category: 'crypto',
    provider: 'Etherscan',
    language: 'php',
    style: 'rest',
    prompt: 'Write a PHP script that shows the ETH balance and the last 10 transactions of an Ethereum address using the Etherscan API.',
    evidence: "Etherscan API V1 stopped on 2025-08-15. It now answers \"You are using a deprecated V1 endpoint, switch to Etherscan API V2\".",
    slots: [
      required('endpoint', 'API version', [
        rule(
          'v1',
          'Etherscan API V1 (/api?module=…)',
          'api\\.etherscan\\.io/api(?![\\w/])',
          fails('2025-08-15', '2025-07-30', ETHERSCAN_V2, {
            quote: 'API V1 will be fully deprecated by August 15, 2025 . After that, all V1 requests will stop working.',
          }),
        ),
        rule('v2', 'Etherscan API V2 (/v2/api with chainid)', 'api\\.etherscan\\.io/v2/api', current(ETHERSCAN_V2)),
        // A client's base URL, then the path on each request (Guzzle's base_uri, then ->get('/api')).
        rule(
          'v1-base',
          'Etherscan API V1 (/api?module=…)',
          'api\\.etherscan\\.io/?["\'][\\s\\S]{0,3000}?["\']/api["\']|api\\.etherscan\\.io/["\'][\\s\\S]{0,3000}?["\']api["\']',
          fails('2025-08-15', '2025-07-30', ETHERSCAN_V2, {
            quote: 'API V1 will be fully deprecated by August 15, 2025 . After that, all V1 requests will stop working.',
          }),
        ),
        rule('v2-base', 'Etherscan API V2 (/v2/api with chainid)', 'api\\.etherscan\\.io/?["\'][\\s\\S]{0,3000}?["\']/?v2/api["\']', current(ETHERSCAN_V2)),
      ]),
    ],
  },
  {
    id: 'jupiter-swap-ts',
    title: 'SOL to USDC swap quote with Jupiter',
    category: 'crypto',
    provider: 'Jupiter',
    language: 'typescript',
    style: 'rest',
    prompt: 'Write a TypeScript function that gets a quote to swap 1 SOL to USDC with Jupiter and returns the serialized swap transaction for the user to sign.',
    evidence: "Jupiter retired its v6 quote API: quote-api.jup.ag no longer resolves (2026-10-19), and lite-api.jup.ag is being phased out for api.jup.ag.",
    slots: [
      required('host', 'Swap API host', [
        rule(
          'quote-api-v6',
          'quote-api.jup.ag/v6',
          'quote-api\\.jup\\.ag',
          fails('2026-10-19', '2024-12-01', JUP_CHANGELOG, {
            origin: 'okapi',
            note: 'Jupiter announced its legacy hosts would be deprecated by June 2025, then sunset them gradually; the host no longer resolves.',
          }),
        ),
        rule(
          'lite-api',
          'lite-api.jup.ag',
          'lite-api\\.jup\\.ag',
          deprecated('2025-11-30', JUP_MIGRATION, { quote: 'lite-api.jup.ag will be phased out once the new API gateway is stable.' }),
        ),
        rule('api-jup', 'api.jup.ag/swap', 'api\\.jup\\.ag/swap', current(JUP_MIGRATION)),
        // The SDK picks the host: lite-api.jup.ag without an API key, api.jup.ag with one (@jup-ag/api 6.0.48).
        rule(
          'sdk-public',
          'lite-api.jup.ag',
          'createJupiterApiClient\\(\\s*(?:\\)|\\{(?![^}]*apiKey))',
          deprecated('2025-11-30', JUP_MIGRATION, { quote: 'lite-api.jup.ag will be phased out once the new API gateway is stable.' }),
        ),
        rule('sdk-key', 'api.jup.ag/swap', 'createJupiterApiClient\\(\\s*\\{[^}]*apiKey', current(JUP_MIGRATION)),
        rule(
          'price-v2',
          'Price API v2',
          'jup\\.ag/price/v2',
          fails('2025-09-30', '2025-06-30', 'https://developers.jup.ag/changelog/2025-06', {
            quote: 'If you are on Price API V2 or Tokens API V1, migrate to the new versions before 30 September 2025.',
          }),
        ),
      ]),
    ],
  },
  {
    id: 'frankfurter-convert-js',
    title: 'Currency conversion with Frankfurter',
    category: 'finance',
    provider: 'Frankfurter',
    language: 'javascript',
    style: 'rest',
    prompt: 'Write a small browser JavaScript function that converts an amount from EUR to USD using the free Frankfurter exchange-rate API.',
    evidence: "Frankfurter moved from api.frankfurter.app to api.frankfurter.dev; the old domain now redirects.",
    slots: [
      required('host', 'API host', [
        rule('app-domain', 'api.frankfurter.app', 'api\\.frankfurter\\.app', deprecated('2024-12-04', FRANKFURTER, { quote: 'Moved domain to <https://api.frankfurter.dev>.' })),
        rule('dev-domain', 'api.frankfurter.dev', 'api\\.frankfurter\\.dev', current(FRANKFURTER)),
      ]),
    ],
  },
];
