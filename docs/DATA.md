# Jumpflix catalog data

Jumpflix publishes a complete snapshot of its public parkour and freerunning catalog on the first day of each month. Downloads are public and require no account or API key.

- [Latest catalog JSON](https://raw.githubusercontent.com/m-a-x-s-e-e-l-i-g/jumpflix.tv/master/data/catalog.json) is a mirror for browsers and other clients. Each update replaces the full snapshot.
- [Latest release metadata](https://raw.githubusercontent.com/m-a-x-s-e-e-l-i-g/jumpflix.tv/master/data/latest.json) gives the dated release asset URLs and schema version.
- [GitHub Releases](https://github.com/m-a-x-s-e-e-l-i-g/jumpflix.tv/releases) has dated snapshots tagged `data-YYYY-MM`. Each release includes `catalog.json` and `catalog.schema.json`. Use a dated download to pin a snapshot.

```js
const url =
	'https://raw.githubusercontent.com/m-a-x-s-e-e-l-i-g/jumpflix.tv/master/data/catalog.json';
const response = await fetch(url);
if (!response.ok) throw new Error(`Catalog download failed (${response.status})`);
const catalog = await response.json();
if (catalog.schemaVersion !== 1) throw new Error('Unsupported Jumpflix catalog schema');

const films = catalog.titles.filter((title) => title.type === 'movie');
console.log(films.map(({ title, url }) => ({ title, url })));
```

`titles` contains films and series. `seasons[].seriesId` points to a series in `titles`, and `episodes[].seasonId` points to a season. IDs are stable within each collection while a record exists. Use IDs for saved items and the supplied Jumpflix URLs for navigation. Removed records disappear from subsequent snapshots.

`year` and `duration` are `null` when unknown. Durations are display strings such as `43m` or `1h 11m`. `access` is Jumpflix's listing of `free`, `paid`, or `unavailable` at export time. Provider availability can change between snapshots.

## License and attribution

Jumpflix licenses its catalog compilation and original metadata in the snapshots under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Credit **Jumpflix.tv**, link to [this dataset](https://github.com/m-a-x-s-e-e-l-i-g/jumpflix.tv/blob/master/docs/DATA.md) and the license, and indicate changes. Third-party rights in titles, names, trademarks, and linked works remain with their owners.

## Generate a snapshot

With `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` set in your environment or local `.env`, run `node --import tsx scripts/export-catalog.ts`. The script writes both files to `.cache/catalog/` after validation. Run **Publish catalog** from the default branch in GitHub Actions to publish the current month's snapshot. A rerun uses the already-published snapshot for that month and can repair its download links.
