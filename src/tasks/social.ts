import type { Task } from '../types.ts';
import { current, deprecated, fails } from '../kb/facts.ts';
import { required, rule } from '../kb/rule.ts';
import { graphVersionRules, linkedinVersionRules } from '../kb/versions.ts';

const LINKEDIN_MIGRATIONS = 'https://learn.microsoft.com/en-us/linkedin/marketing/integrations/migrations';
const X_CHANGELOG = 'https://docs.x.com/changelog';
const YT_HISTORY = 'https://developers.google.com/youtube/v3/revision_history';
const SPOTIFY_2024 = 'https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api';
const SPOTIFY_2026 = 'https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide';

const spotifyNewApps = {
  quote: 'Effective today, new Web API use cases will no longer be able to access or use the following endpoints and functionality in their third-party applications.',
  note: 'A new app gets 403 on these endpoints.',
};

export const SOCIAL_TASKS: Task[] = [
  {
    id: 'facebook-page-post-node',
    title: 'Publish to a Facebook Page with the Graph API',
    category: 'social',
    provider: 'Meta Graph API',
    language: 'javascript',
    style: 'rest',
    prompt: 'Write a Node.js script that publishes a post with a link to my Facebook Page through the Graph API, using a Page access token.',
    evidence: "Meta serves each Graph API version for about two years, then answers it from a newer one: v18.0 has been redirected since 2026-01-26, and v21.0 is next.",
    slots: [required('version', 'Graph API version', graphVersionRules())],
  },
  {
    id: 'linkedin-followers-py',
    title: 'LinkedIn organization follower statistics',
    category: 'social',
    provider: 'LinkedIn',
    language: 'python',
    style: 'rest',
    prompt:
      'Write a Python script that fetches the follower statistics (total followers and gains over the last 30 days) of my LinkedIn company page through the LinkedIn API.',
    evidence: "LinkedIn shut down the unversioned /v2 organization statistics endpoints on 2024-12-16. Calls now go through the versioned REST API with a LinkedIn-Version header, and each version lasts a year.",
    slots: [
      required('endpoint', 'Statistics endpoint', [
        rule(
          'v2-follower-stats',
          '/v2/organizationalEntityFollowerStatistics (unversioned)',
          '/v2/organizationalEntityFollowerStatistics|/v2/networkSizes|/v2/organizationPageStatistics',
          fails('2024-12-16', undefined, LINKEDIN_MIGRATIONS, {
            quote: 'Developers using LinkedIn Marketing APIs unversioned to migrate to the latest versions.',
            note: 'Call /rest/organizationalEntityFollowerStatistics with a LinkedIn-Version header (YYYYMM).',
          }),
        ),
        rule('stats-named', 'follower statistics named in the code', 'organizationalEntityFollowerStatistics|networkSizes', current(LINKEDIN_MIGRATIONS)),
        rule(
          'v2-base-stats',
          'api.linkedin.com/v2 base for the statistics calls',
          'api\\.linkedin\\.com/v2(?=["\'`/])',
          fails('2024-12-16', undefined, LINKEDIN_MIGRATIONS, { quote: 'Developers using LinkedIn Marketing APIs unversioned to migrate to the latest versions.' }),
          { requires: ['endpoint.stats-named'], unless: ['endpoint.rest-base'] },
        ),
        rule('rest-base', 'api.linkedin.com/rest base', 'api\\.linkedin\\.com/rest(?=["\'`/])', current(LINKEDIN_MIGRATIONS)),
        rule('rest-follower-stats', '/rest/organizationalEntityFollowerStatistics (versioned)', '/rest/(?:organizationalEntityFollowerStatistics|networkSizes)', current(LINKEDIN_MIGRATIONS)),
        ...linkedinVersionRules(),
      ]),
    ],
  },
  {
    id: 'x-search-py',
    title: 'Search recent posts on X',
    category: 'social',
    provider: 'X API',
    language: 'python',
    style: 'sdk',
    prompt: 'Write a Python script that fetches the 20 most recent posts on X (Twitter) mentioning a given keyword and prints their text and author.',
    evidence: "A control task: X deprecated the v1.1 search endpoints on 2023-09-28.",
    slots: [
      required('endpoint', 'Search endpoint', [
        rule(
          'v1-search',
          'v1.1 search/tweets',
          '1\\.1/search/tweets|\\.search_tweets\\s*\\(|api\\.search\\s*\\(|GetSearch\\s*\\(',
          deprecated('2023-09-28', X_CHANGELOG, {
            quote: 'Today, we are deprecating the search/tweets, users/search, and geo/search endpoints in the X API v1.1.',
            note: 'Search with the X API v2 (GET /2/tweets/search/recent).',
          }),
        ),
        rule('v2-search', 'v2 tweets/search/recent', '/2/tweets/search/recent|search_recent_tweets\\s*\\(|\\.v2\\.search\\s*\\(', current(X_CHANGELOG)),
      ]),
    ],
  },
  {
    id: 'youtube-related-py',
    title: 'Videos related to a YouTube video',
    category: 'media',
    provider: 'YouTube Data API',
    language: 'python',
    style: 'sdk',
    prompt: 'Write a Python script that lists ten videos related to a given YouTube video ID, with their titles and URLs, using the YouTube Data API.',
    evidence: "YouTube stopped supporting search.list with relatedToVideoId on 2023-08-07.",
    slots: [
      required('param', 'How related videos are found', [
        rule(
          'related-to-video-id',
          'search.list relatedToVideoId',
          'relatedToVideoId',
          fails('2023-08-07', '2023-06-12', YT_HISTORY, {
            quote: "The search.list method's relatedToVideoId parameter has been deprecated. YouTube will stop supporting the parameter as of August 7, 2023.",
          }),
        ),
        rule('search-by-query', 'search.list with a query', '(?<![\\w])q\\s*[=:]|["\']q["\']\\s*:', current(YT_HISTORY)),
      ]),
    ],
  },
  {
    id: 'spotify-similar-js',
    title: 'A playlist of similar tracks on Spotify',
    category: 'media',
    provider: 'Spotify Web API',
    language: 'javascript',
    style: 'rest',
    prompt:
      'Write a Node.js script that takes a Spotify track ID and creates a new playlist in my account with 20 similar tracks, using the Spotify Web API.',
    evidence: "Spotify closed recommendations, audio features and related artists to new apps on 2024-11-27, and renamed the playlist /tracks endpoints to /items on 2026-02-11.",
    slots: [
      required('endpoint', 'Endpoints', [
        rule('recommendations', 'GET /v1/recommendations', '/v1/recommendations|/recommendations\\?|getRecommendations\\s*\\(|\\.recommendations\\s*\\(', fails('2024-11-27', '2024-11-27', SPOTIFY_2024, spotifyNewApps)),
        rule('audio-features', 'GET /v1/audio-features', '/audio-features(?![\\w-])|/audio-features[/?"\'`]|getAudioFeaturesFor|\\.audio_features\\s*\\(', fails('2024-11-27', '2024-11-27', SPOTIFY_2024, spotifyNewApps)),
        rule('related-artists', 'GET /v1/artists/{id}/related-artists', 'related-artists|getArtistRelatedArtists|artist_related_artists', fails('2024-11-27', '2024-11-27', SPOTIFY_2024, spotifyNewApps)),
        rule(
          'playlist-tracks',
          'POST /v1/playlists/{id}/tracks',
          '/playlists/[^\\s"\'`]*/tracks(?![\\w-])|addTracksToPlaylist\\s*\\(',
          fails('2026-02-11', '2026-02-06', SPOTIFY_2026, {
            quote: 'The playlist track management endpoints have been renamed from /tracks to /items',
          }),
        ),
        rule('playlist-items', 'POST /v1/playlists/{id}/items', '/playlists/[^\\s"\'`]*/items', current(SPOTIFY_2026)),
      ]),
    ],
  },
];
