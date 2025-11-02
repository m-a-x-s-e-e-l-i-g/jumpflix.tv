# Admin CLI Updates

## What's New

### 🎨 Auto-Generated Blurhash
- When adding movies or series, the CLI now automatically generates blurhash from the thumbnail URL
- You'll be prompted whether to generate it (defaults to yes)
- No more manual blurhash generation needed!

### 🔄 Automatic Episode Syncing
- **Episodes are now automatically synced from YouTube playlists**
- You no longer manually add episodes - they're fetched from YouTube
- When creating a series, you can immediately sync episodes from playlists

### 🆕 New "Refresh Episodes" Menu
Replaces the old "Add Episodes" option with three powerful sync options:

1. **Refresh specific series** - Sync all seasons for one series
2. **Refresh specific season** - Sync just one season  
3. **Refresh all series** - Sync your entire catalog

### ✨ What Happens During Sync
- Fetches latest episodes from YouTube playlists (using public Atom feeds, no API key needed)
- Adds new episodes that aren't in the database
- Updates existing episodes with latest info (titles, thumbnails, etc.)
- Preserves episode ordering and numbering

## Breaking Changes

- **Manual episode adding removed** - All episodes must come from YouTube playlists
- Each season requires a YouTube playlist ID to sync episodes
- If you have episodes not linked to playlists, they won't auto-update

## Migration Notes

If you have existing series:
1. Make sure each season has a `playlist_id` set
2. Run "Refresh Episodes" to sync from YouTube
3. Existing episodes will be updated based on video ID or episode number

## Technical Details

### New Files
- `scripts/utils/blurhash-generator.ts` - Utility for generating blurhash from URLs
- `scripts/utils/youtube-sync.ts` - YouTube playlist episode syncing

### Updated Files
- `scripts/admin-cli.ts` - Integrated new features, removed manual episode adding

### Dependencies
No new dependencies added - uses existing `sharp` and `blurhash` packages.
