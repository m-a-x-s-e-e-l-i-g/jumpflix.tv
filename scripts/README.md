# JumpFlix Admin CLI

Interactive command-line tool for managing movies, series, and episodes in your Supabase database.

## Setup

1. **Create `.env.local` file** with your Supabase credentials:

```bash
PUBLIC_SUPABASE_URL=https://your-project.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

> **Note:** The CLI will work with the anon key, but using the service role key gives you admin privileges and bypasses RLS policies.

1. **Install dependencies** (if you haven't already):

```bash
npm install
```

## Usage

Run the admin CLI:

```bash
npm run admin
```

## Features

### 🎥 Add Movie

Add a new movie with all metadata:

- Title, slug (auto-generated from title)
- Description
- Year, duration
- Video ID, Vimeo ID
- Thumbnail URL
- **Auto-generate blurhash** from thumbnail image
- Paid/free flag
- Provider info
- Creators and cast (comma-separated)

### 📺 Add Series

Create a new series with seasons:

- Series metadata (similar to movies)
- **Auto-generate blurhash** from thumbnail image
- Automatically create seasons with YouTube playlist IDs
- **Option to sync episodes immediately** from YouTube playlists

### � Refresh Episodes

Automatically sync episodes from YouTube playlists:

- **Refresh specific series** - Sync all seasons for one series
- **Refresh specific season** - Sync just one season
- **Refresh all series** - Sync episodes for your entire catalog

Episodes are automatically fetched from YouTube playlists (no API key required). The system will:

- Add new episodes that aren't in the database
- Update existing episodes with latest info
- Preserve episode numbers and ordering

### 📋 List All Content

View all your movies and series with their basic info

### ✏️ Edit Content

Update existing content metadata

### 🗑️ Delete Content

Remove content from your database (cascades to seasons/episodes)

## Important Notes

- **Episodes are managed automatically** from YouTube playlists - you don't manually add them
- **Blurhash is auto-generated** when you provide a thumbnail URL
- Each season needs a YouTube playlist ID to auto-sync episodes
- The YouTube sync uses public Atom feeds (no API key required)

## Tips

- **Slugs are auto-generated** from titles (e.g., "The Matrix" → "the-matrix")
- **Leave fields empty** to skip optional fields
- **Comma-separated lists** for creators and cast (e.g., "John Doe, Jane Smith")
- **Press Ctrl+C** anytime to exit
- All changes are **immediate** - be careful with deletions!

## Security

⚠️ This tool is meant for **local admin use only**. Never commit your `.env.local` file or expose your service role key.

The `.env.local` file is already in `.gitignore` to prevent accidental commits.
