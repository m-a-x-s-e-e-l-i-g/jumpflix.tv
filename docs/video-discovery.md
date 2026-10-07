# Film video discovery

Film pages keep the existing JUMPFLIX layout and **Play now** flow. Playback opens the enhanced custom player with its watch progress, XP and completion features. No additional provider/native player is rendered on the detail page.

The server emits `VideoObject` metadata only when the film has a verified upload date for its current playback source and a valid thumbnail. Paid/external, unavailable and Family safe blocked films omit video schema.

`media_items.video_metadata` stores `{sourceKey, publishedAt}`. `publishedAt` comes from the matching YouTube video's `uploadDate` or Vimeo video's `upload_date`; it is not inferred from the film's release year, catalog timestamps or YouTube's separate publication field. Invalid or missing dates are omitted. If the playback source changes, the stored date stops being used. Public page loads read stored metadata and do not make provider requests.

New films fetch verified metadata on the server when saved. Provider failures do not block saving. The shared provider parser also powers the admin metadata preview.

## Backfill existing films

The migration and backfill have not been applied to production. Review this PR before any rollout. A future rollout needs the migration before the updated admin save path, followed by a backfill for existing films.

```sh
# Read-only: public Supabase credentials from .env; no database writes.
npm run backfill:video-metadata -- --limit=3 --output=.cache/video-dates.json
npm run backfill:video-metadata -- --slug=city-surfers-2007

# Future authorized rollout only, after applying the migration:
# Requires SUPABASE_SERVICE_ROLE_KEY. No limit means the entire film catalog.
npm run backfill:video-metadata -- --apply --output=.cache/video-dates-applied.json
```

The backfill preserves dates already verified for the current source, skips unsupported sources, reports missing dates/failures, and matches the source fields and previous metadata before updating. Re-running it resumes naturally. Failed provider lookups do not erase existing data. Clear/reload the content cache after an authorized backfill, or wait for its normal expiry.

Read-only provider samples verified on 2026-10-07:

| Film           | Source                | Verified upload date   |
| -------------- | --------------------- | ---------------------- |
| Jump London    | YouTube `l8fSXGP9wvQ` | `2012-09-02T12:23:24Z` |
| Jump Britain   | YouTube `2TJurAP9l-Q` | `2019-12-05T12:31:16Z` |
| Sole Destroyer | YouTube `VlM7bOegiIg` | `2022-12-24T17:00:07Z` |
| City Surfers   | Vimeo `21018223`      | `2011-03-14`           |

Vimeo's timezone-free timestamps are reduced to their calendar date; midnight in the serialized value does not assert a verified upload time.

Direct/HLS streams need a verified date from their source owner before they can emit video markup; this import does not guess one. Episodes retain their existing date/markup path.

This PR improves metadata while preserving the viewing experience. It does not solve player discovery without interaction: Google recommends ordinary HTML video elements and says video loading must not depend on user actions. The current custom player still loads after Play now. There is no hidden or crawler-only player. See [video discovery guidance](https://developers.google.com/search/docs/appearance/video) and [VideoObject requirements](https://developers.google.com/search/docs/appearance/structured-data/video). Video indexing is not verified or guaranteed by these changes or the local tests.
