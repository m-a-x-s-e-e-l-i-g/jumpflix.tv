# Search and AI discovery

Jumpflix's public catalog, film pages, series, episodes, collections and credits are
server-rendered. Their content and links are available without JavaScript or login.
The live `/sitemap.xml` includes those URLs and updates independently of deployments.

`static/robots.txt` explicitly allows `OAI-SearchBot`, which OpenAI uses for ChatGPT
search discovery, alongside ordinary search crawlers. Its rules exclude admin,
OAuth, password-reset and individual user-statistics URLs. GPTBot is a separate
training crawler; this change does not change the existing training opt-in.

Film structured data includes the full synopsis, runtime, facets and credit links.
Series structured data connects real seasons and episodes to their canonical URLs.
Unknown dates and runtimes are omitted. A film's release year or catalog insertion
date must never be used to invent a video's upload date.

## Verification

- `npm run check`
- `npm run test:seo`
- With the dev server running: set `JUMPFLIX_TEST_URL=http://127.0.0.1:5173` and
  run `npm run test:seo` for read-only HTTP checks of actual catalog records.
- After deployment, run `npm run check:sitemap` against the live site.

## After deployment

1. Verify public URLs return HTTP 200 to OAI-SearchBot without a login, challenge
   or bot block. If adding firewall rules, use OpenAI's published IP ranges.
2. Verify the site in Google Search Console and Bing Webmaster Tools and submit
   `https://www.jumpflix.tv/sitemap.xml`. Inspect representative film, series,
   episode and collection URLs. The repository's sitemap ping script is not a
   substitute for these tools.
3. Keep film descriptions specific and accurate; include known credits, runtime,
   release year, facets and legitimate viewing links. Improve thin records through
   the admin UI. Useful descriptions and authentic references from filmmakers and
   parkour communities help establish Jumpflix as a resource.
4. Monitor crawl/indexing reports and referral visits tagged `utm_source=chatgpt.com`.
   Treat occasional manual ChatGPT searches as examples, not a stable ranking report.

These changes support crawling and interpretation; they do not guarantee indexing,
ranking, recommendations or citations. Neither a connected MCP catalog nor an
`llms.txt` file guarantees inclusion in ordinary ChatGPT search answers.

Official references:

- [OpenAI crawler documentation](https://developers.openai.com/api/docs/bots)
- [Google Search AI features](https://developers.google.com/search/docs/appearance/ai-features)
- [Schema.org TVSeries](https://schema.org/TVSeries)
