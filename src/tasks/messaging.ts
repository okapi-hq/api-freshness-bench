import type { Task } from '../types.ts';
import { current, deprecated, fails, invalid } from '../kb/facts.ts';
import { required, rule, slot } from '../kb/rule.ts';

const TG_CHANGELOG = 'https://core.telegram.org/bots/api-changelog';
const PTB_V20 = 'https://github.com/python-telegram-bot/python-telegram-bot/wiki/Transition-guide-to-Version-20.0';
const PTB_V22 = 'https://raw.githubusercontent.com/python-telegram-bot/python-telegram-bot/master/changes/22.0_2025-03-15/4671.7B3boYRvHdGzsrZgkpKp7B.toml';
const DJS_V14 = 'https://discordjs.guide/additional-info/changes-in-v14.html';
const SLACK_UPLOAD = 'https://docs.slack.dev/reference/methods/files.upload';
const FCM_MIGRATE = 'https://fcm.googleapis.com/fcm/send';
const ADMIN_V13 = 'https://github.com/firebase/firebase-admin-node/releases/tag/v13.0.0';
const ADMIN_V14 = 'https://github.com/firebase/firebase-admin-node/releases/tag/v14.0.0';
const RESEND = 'https://resend.com/docs/dashboard/contacts/migrating-from-audiences-to-segments';

const linkPreview = [
  rule(
    'disable-web-page-preview',
    'disable_web_page_preview',
    '(?<![\\w])disable_web_page_preview|disableWebPagePreview',
    deprecated('2023-12-29', TG_CHANGELOG, {
      quote: 'replaced the parameter disable_web_page_preview with link_preview_options in the methods sendMessage and editMessageText.',
      note: 'Deprecated on sendMessage and editMessageText alike, in favor of link_preview_options.',
    }),
  ),
  rule('link-preview-options', 'link_preview_options', 'link_preview_options|LinkPreviewOptions|linkPreviewOptions', current(TG_CHANGELOG)),
];

const ptb = slot('sdk', 'python-telegram-bot API', [
  rule(
    'ptb-v13',
    'python-telegram-bot 13 API (use_context, dispatcher, Filters)',
    'use_context\\s*=|\\.dispatcher\\b|(?<![\\w.])Filters\\.|from telegram\\.ext import[^\\n]*\\bFilters\\b',
    invalid(PTB_V20, { origin: 'changelog', note: 'python-telegram-bot 20 removed use_context, the dispatcher and Filters (now filters).', announced: '2023-01-01' }),
    { sdk: { pkg: 'python-telegram-bot', breaksFrom: 20, pinned: deprecated('2023-01-01', PTB_V20, { origin: 'changelog' }) } },
  ),
  rule(
    'ptb-defaults-preview',
    'Defaults(disable_web_page_preview=…) (removed in 22.0)',
    'Defaults\\([^)]*disable_web_page_preview',
    invalid(PTB_V22, { origin: 'changelog', quote: 'Removed Defaults.disable_web_page_preview and Defaults.quote.', announced: '2025-03-15' }),
    { sdk: { pkg: 'python-telegram-bot', breaksFrom: 22, pinned: deprecated('2023-12-29', TG_CHANGELOG) } },
  ),
  rule('ptb-application', 'Application.builder() (20+)', 'Application\\.builder\\(\\)|ApplicationBuilder\\(\\)', current(PTB_V20)),
]);

const discordSdk = required('sdk', 'discord.js API', [
  rule(
    'djs-v13',
    'discord.js 13 API (Intents.FLAGS, MessageEmbed, MessageActionRow)',
    'Intents\\.FLAGS|new\\s+MessageEmbed\\s*\\(|MessageActionRow|MessageButton\\s*\\(|\\.isCommand\\(\\)',
    invalid(DJS_V14, { origin: 'changelog', note: 'discord.js 14 replaced Intents.FLAGS, MessageEmbed and MessageActionRow with GatewayIntentBits, EmbedBuilder and ActionRowBuilder.', announced: '2022-07-18' }),
    { sdk: { pkg: 'discord.js', breaksFrom: 14, pinned: deprecated('2022-07-18', DJS_V14, { origin: 'changelog' }) } },
  ),
  rule(
    'djs-message-event',
    "client.on('message') (removed event)",
    "\\.on\\(\\s*['\"]message['\"]",
    invalid(DJS_V14, { origin: 'changelog', announced: '2021-08-05', note: "Listen to 'messageCreate'." }),
    { sdk: { pkg: 'discord.js', breaksFrom: 14, pinned: deprecated('2021-08-05', DJS_V14, { origin: 'changelog' }) } },
  ),
  rule('djs-v14', 'discord.js 14 API (GatewayIntentBits, EmbedBuilder)', 'GatewayIntentBits|EmbedBuilder|SlashCommandBuilder', current(DJS_V14)),
  rule(
    'discord-api-old',
    'Discord API v6 to v8 in a URL',
    'discord(?:app)?\\.com/api/v[678]/|version:\\s*["\'][678]["\']',
    deprecated(undefined, 'https://docs.discord.com/developers/reference.md', { note: 'Use v10.' }),
  ),
]);

const slackUpload = required('method', 'Upload method', [
  rule(
    'files-upload',
    'files.upload',
    'files_upload(?!_v2)\\s*\\(|files\\.upload(?!V2|_v2)\\s*\\(|/api/files\\.upload(?!V2)\\b',
    fails('2025-11-12', '2024-04-09', SLACK_UPLOAD, {
      quote: 'The files.upload API method has been deprecated. It will stop functioning and be officially sunset on November 12, 2025.',
      note: 'Upload with files.getUploadURLExternal then files.completeUploadExternal (files_upload_v2 in the SDKs).',
    }),
  ),
  rule('files-upload-v2', 'files_upload_v2 / uploadV2', 'files_upload_v2\\s*\\(|uploadV2\\s*\\(|getUploadURLExternal', current(SLACK_UPLOAD)),
]);

const fcm = required('fcm', 'FCM send path', [
  rule(
    'legacy-http',
    'legacy FCM HTTP API (/fcm/send, server key)',
    'fcm\\.googleapis\\.com/fcm/send|Authorization["\']?\\s*[:,]\\s*[`"\']key=',
    fails('2024-07-22', '2023-06-20', FCM_MIGRATE, {
      note: 'Firebase deprecated the legacy HTTP and XMPP APIs on 2023-06-20 and began shutting them down on 2024-07-22; /fcm/send answers 404 (checked 2026-10-24).',
    }),
  ),
  rule(
    'admin-legacy-send',
    'sendToDevice / sendMulticast / sendAll (removed in firebase-admin 13)',
    '\\.(?:sendToDevice|sendToDeviceGroup|sendToTopic|sendToCondition|sendMulticast|sendAll)\\s*\\(',
    invalid(ADMIN_V13, { origin: 'changelog', quote: 'change(fcm): Remove deprecated FCM APIs', note: 'sendAll, sendMulticast, sendToDevice, sendToDeviceGroup, sendToTopic and sendToCondition are gone from firebase-admin 13.', announced: '2024-11-12' }),
    { sdk: { pkg: 'firebase-admin', breaksFrom: 13, pinned: fails('2024-06-21', '2023-06-20', FCM_MIGRATE) } },
  ),
  rule(
    'admin-namespace',
    'admin.initializeApp() / admin.messaging() (namespaced API, removed in firebase-admin 14)',
    'admin\\.initializeApp\\s*\\(|admin\\.messaging\\s*\\(|admin\\.credential\\.',
    invalid(ADMIN_V14, { origin: 'changelog', quote: 'change: Remove Deprecated Legacy Namespace Support', announced: '2026-06-08' }),
    { sdk: { pkg: 'firebase-admin', breaksFrom: 14, pinned: deprecated('2021-10-25', ADMIN_V14, { origin: 'changelog' }) } },
  ),
  rule('admin-modular', 'firebase-admin modular API (getMessaging)', 'getMessaging\\s*\\(|firebase-admin/messaging', current(ADMIN_V14)),
  rule('http-v1', 'FCM HTTP v1 (messages:send)', '/v1/projects/[^"\'`]*/messages:send', current(FCM_MIGRATE)),
]);

const resendAudience = required('contacts', 'Contacts API', [
  rule(
    'audiences',
    'Audiences (audienceId on contacts)',
    '/audiences|audienceId|audience_id|\\.audiences\\.',
    deprecated('2025-11-05', RESEND, {
      quote: 'The Audiences API is now deprecated and will be removed in the future.',
      note: 'Create contacts without audience_id and group them with the Segments API.',
    }),
  ),
  rule('contacts', 'Contacts API', 'contacts\\.create\\s*\\(|/contacts', current(RESEND)),
]);

export const MESSAGING_TASKS: Task[] = [
  {
    id: 'telegram-news-py',
    title: 'Telegram bot that posts links without previews',
    category: 'social',
    provider: 'Telegram',
    language: 'python',
    style: 'sdk',
    prompt:
      'Write a Telegram bot in Python that answers the /news command with the five latest Hacker News headlines as links, with link previews turned off.',
    evidence: "Telegram deprecated disable_web_page_preview in favor of link_preview_options in December 2023, and it is still among the breaking changes Okapi finds most often. python-telegram-bot 13 code does not run on version 20 and later.",
    slots: [required('preview', 'Link preview option', linkPreview), ptb],
  },
  {
    id: 'telegram-post-go',
    title: 'Post to a Telegram channel over HTTP, in Go',
    category: 'social',
    provider: 'Telegram',
    language: 'go',
    style: 'rest',
    prompt:
      'Write a Go program that posts a message with a link to a Telegram channel through the Bot API over HTTP (net/http, no SDK), with the link preview disabled.',
    evidence: "The same Telegram change over raw HTTP: disable_web_page_preview is deprecated in favor of link_preview_options.",
    slots: [required('preview', 'Link preview option', linkPreview)],
  },
  {
    id: 'discord-slash-js',
    title: 'Discord bot with a slash command',
    category: 'social',
    provider: 'Discord',
    language: 'javascript',
    style: 'sdk',
    prompt:
      'Write a Discord bot in Node.js with discord.js that registers a /weather slash command and replies with an embed showing the temperature for a city (use a placeholder weather lookup).',
    evidence: "A control task: the discord.js 13 API (Intents.FLAGS, MessageEmbed) and the removed message event are old, well-known changes.",
    slots: [discordSdk],
  },
  {
    id: 'slack-upload-py',
    title: 'Upload a report to Slack',
    category: 'productivity',
    provider: 'Slack',
    language: 'python',
    style: 'sdk',
    prompt: 'Write a Python script that uploads a CSV report file to a Slack channel with a short comment, using the Slack Web API.',
    evidence: "Slack stopped files.upload on 2025-11-12; uploads now go through files_upload_v2 and the external upload flow.",
    slots: [slackUpload],
  },
  {
    id: 'fcm-push-node',
    title: 'Send a push notification with Firebase Cloud Messaging',
    category: 'communication',
    provider: 'Firebase Cloud Messaging',
    language: 'javascript',
    style: 'sdk',
    prompt:
      'Write a Node.js backend function that sends a push notification (title, body and a data payload) to a list of device registration tokens with Firebase Cloud Messaging.',
    evidence: "Google shut down the legacy FCM HTTP API (/fcm/send with a server key) in 2024, and firebase-admin removed sendToDevice, sendMulticast and sendAll.",
    slots: [fcm],
  },
  {
    id: 'resend-newsletter-ts',
    title: 'Newsletter sign-up with Resend',
    category: 'communication',
    provider: 'Resend',
    language: 'typescript',
    style: 'sdk',
    prompt:
      'Write a Next.js server action that adds the email address from a newsletter sign-up form to my Resend contacts list for the newsletter, then sends a welcome email.',
    evidence: "Resend deprecated Audiences (audienceId on contacts) in November 2025.",
    slots: [resendAudience],
  },
];
