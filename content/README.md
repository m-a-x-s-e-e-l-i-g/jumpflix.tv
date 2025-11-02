# Content Management

This directory contains JSON files for managing movies and series content in JumpFlix.

## Quick Start

### Adding Movies

Edit `movies.json` and add your movie entries:

```json
{
  "id": 2,
  "title": "My Awesome Movie",
  "description": "Description here",
  "thumbnail": "/images/posters/my-movie.jpg",
  "year": "2024",
  "duration": "90 min",
  "videoId": "YouTube-Video-ID",
  "vimeoId": null,
  "paid": false,
  "provider": "YouTube",
  "externalUrl": null,
  "trakt": null,
  "creators": ["Director Name"],
  "starring": ["Actor 1", "Actor 2"]
}
```

### Adding Series

Edit `series.json` and add your series entries:

```json
{
  "id": 2,
  "title": "My Series",
  "description": "Series description",
  "thumbnail": "/images/posters/my-series.jpg",
  "paid": false,
  "provider": "YouTube",
  "externalUrl": null,
  "creators": ["Creator"],
  "starring": ["Star 1"],
  "videoCount": 8,
  "seasons": [
    {
      "seasonNumber": 1,
      "playlistId": "PLxxxxxxxxxx"
    },
    {
      "seasonNumber": 2,
      "playlistId": "PLyyyyyyyyyy"
    }
  ]
}
```

## Seeding to Database

Once you've added your content to the JSON files, run:

```bash
npm run seed
```

This will:
1. Read all movies from `content/movies.json`
2. Read all series from `content/series.json`
3. Upsert them into your Supabase database
4. Automatically fetch episode details from YouTube playlists

## Field Reference

### Movie Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | number | Yes | Unique identifier (use sequential numbers) |
| `title` | string | Yes | Movie title |
| `description` | string | No | Movie description |
| `thumbnail` | string | No | Path to poster image |
| `year` | string | No | Release year |
| `duration` | string | No | Duration (e.g., "120 min") |
| `videoId` | string | No | YouTube video ID |
| `vimeoId` | string | No | Vimeo video ID |
| `paid` | boolean | No | Whether content is paid (default: false) |
| `provider` | string | No | Video provider (e.g., "YouTube", "Vimeo") |
| `externalUrl` | string | No | External link |
| `trakt` | string | No | Trakt.tv identifier |
| `creators` | string[] | No | Array of director/creator names |
| `starring` | string[] | No | Array of actor names |

### Series Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | number | Yes | Unique identifier (use sequential numbers) |
| `title` | string | Yes | Series title |
| `description` | string | No | Series description |
| `thumbnail` | string | No | Path to poster image |
| `paid` | boolean | No | Whether content is paid (default: false) |
| `provider` | string | No | Video provider |
| `externalUrl` | string | No | External link |
| `creators` | string[] | No | Array of creator names |
| `starring` | string[] | No | Array of actor names |
| `videoCount` | number | No | Total number of episodes |
| `seasons` | Season[] | Yes | Array of season objects |

### Season Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `seasonNumber` | number | Yes | Season number (1, 2, 3...) |
| `playlistId` | string | Yes | YouTube playlist ID for this season |

## Tips

- **IDs**: Use sequential numbers. Movies typically use 1-999, series use 1000+
- **Thumbnails**: Store poster images in `/static/images/posters/`
- **YouTube IDs**: Just the video ID (e.g., `dQw4w9WgXcQ` from `youtube.com/watch?v=dQw4w9WgXcQ`)
- **Playlist IDs**: Just the playlist ID (e.g., `PLxxxxxx` from `youtube.com/playlist?list=PLxxxxxx`)
- **Episodes**: Are automatically fetched from YouTube playlists - you don't need to add them manually!
- **Blurhash**: Generated automatically from thumbnails if available

## Environment Variables

Make sure you have these set in your `.env` file:

```env
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
YOUTUBE_API_KEY=your-youtube-api-key
```

## Troubleshooting

- **"Missing SUPABASE_URL"**: Make sure your `.env` file is set up correctly
- **Duplicate slugs**: The script automatically handles this by appending IDs
- **Episodes not fetching**: Check your YouTube API key and playlist IDs
- **Invalid JSON**: Use a JSON validator (most editors have one built-in)
