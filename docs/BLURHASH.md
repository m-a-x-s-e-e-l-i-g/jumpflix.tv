# BlurHash placeholders for posters

We precompute [BlurHash](https://blurha.sh/) strings for every poster in `static/images/posters`. These are rendered as lightweight CSS gradients via `@unpic/placeholder` and applied as the background behind the `<Image>` poster, improving perceived load and avoiding jank.

## Regenerate after adding/changing posters

1. Install deps (first time):

```powershell
npm install
```

1. Generate mapping:

```powershell
# Skip recomputing existing up-to-date posters by default
npm run generate:blurhash

# Force recomputing all hashes
npm run generate:blurhash -- --force

# Prune entries for images that no longer exist
npm run generate:blurhash -- --prune
```

This writes `src/lib/assets/blurhash.ts`.

1. Typecheck/build:

```sh
npm run check
```

## Implementation notes

- UI reads from `posterBlurhash[thumbnailPath]`. You can also set `blurhash` on a content item directly to override.
- Generation uses `sharp` to decode images and `blurhash` to encode with 4x4 components.
- The placeholder is applied as a background-image style to the poster container in `ContentCard.svelte`.
