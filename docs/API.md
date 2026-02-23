# JumpFlix External API

This document describes the external API endpoints available for integration partners (e.g., [parkour.spot](https://parkour.spot)).

## Authentication

All endpoints require a **Bearer token** in the `Authorization` header:

```
Authorization: Bearer <token>
```

The token is configured via the `PARKOUR_SPOT_BEARER_TOKEN` environment variable on the JumpFlix server.

---

## Endpoints

### 1. `GET /api/v1/videos`

Returns a mapping of JumpFlix video IDs to the parkour spot IDs featured in those videos.

#### Query parameters

| Parameter | Type   | Required | Description |
|-----------|--------|----------|-------------|
| `spotId`  | string | No       | Filter to only videos that feature this specific spot ID. |
| `type`    | `"movie" \| "series"` | No | Filter to only films (`"movie"`) or series (`"series"`). |

#### Response

```json
{
  "videos": [
    {
      "jumpflixId": 42,
      "spotIds": ["abc123", "def456"]
    }
  ]
}
```

| Field        | Type       | Description |
|--------------|------------|-------------|
| `jumpflixId` | `number`   | The numeric database ID of the JumpFlix media item. |
| `spotIds`    | `string[]` | Array of parkour.spot spot IDs featured in this video. |

#### Example – all video↔spot mappings

```
GET /api/v1/videos
Authorization: Bearer <token>
```

#### Example – all videos for a specific spot

```
GET /api/v1/videos?spotId=abc123
Authorization: Bearer <token>
```

#### Example – all films featuring a spot

```
GET /api/v1/videos?spotId=abc123&type=movie
Authorization: Bearer <token>
```

#### Example – all series featuring a spot

```
GET /api/v1/videos?spotId=abc123&type=series
Authorization: Bearer <token>
```


---

### 2. `GET /api/v1/videos/:id`

Returns full metadata for a JumpFlix video, including all approved spot chapters.

#### Path parameters

| Parameter | Type     | Description |
|-----------|----------|-------------|
| `id`      | `number` | The numeric JumpFlix media item ID. |

#### Response

```json
{
  "id": 42,
  "slug": "my-parkour-film",
  "type": "movie",
  "title": "My Parkour Film",
  "description": "A short film about parkour.",
  "thumbnail": "https://www.jumpflix.tv/images/posters/my-parkour-film.webp",
  "year": "2023",
  "duration": "12m",
  "creators": ["Jane Doe"],
  "starring": ["John Smith"],
  "facets": {
    "type": "fiction",
    "mood": ["energetic"],
    "movement": ["flow"],
    "environment": "street",
    "filmStyle": "cinematic",
    "theme": "team"
  },
  "url": "https://www.jumpflix.tv/movie/my-parkour-film",
  "spots": [
    {
      "spotId": "abc123",
      "startSeconds": 60,
      "endSeconds": 90
    },
    {
      "spotId": "def456",
      "startSeconds": 120,
      "endSeconds": 145,
      "playbackKey": "PLxxx_vid456"
    }
  ]
}
```

#### Response fields

| Field         | Type                    | Always present | Description |
|---------------|-------------------------|----------------|-------------|
| `id`          | `number`                | ✅             | Numeric database ID of the media item. |
| `slug`        | `string`                | ✅             | URL-friendly identifier. |
| `type`        | `"movie" \| "series"`  | ✅             | Content type. |
| `title`       | `string`                | ✅             | Display title. |
| `description` | `string`                | No             | Synopsis / short description. |
| `thumbnail`   | `string`                | No             | URL of the thumbnail image. |
| `year`        | `string`                | No             | Release year (e.g. `"2023"`). |
| `duration`    | `string`                | No             | Human-readable duration (e.g. `"1h 12m"`, `"40m"`). |
| `creators`    | `string[]`              | No             | Directors / creators. |
| `starring`    | `string[]`              | No             | Featured athletes / performers. |
| `facets`      | `object`                | No             | Categorisation tags (see below). |
| `url`         | `string`                | ✅             | Canonical JumpFlix URL for this video. |
| `spots`       | `SpotChapter[]`         | ✅             | Approved spot chapters (may be empty). |

##### `facets` sub-fields

| Field         | Type       | Possible values |
|---------------|------------|-----------------|
| `type`        | `string`   | `fiction`, `documentary`, `session`, `event`, `tutorial` |
| `mood`        | `string[]` | `energetic`, `chill`, `gritty`, `wholesome`, `artistic` |
| `movement`    | `string[]` | `flow`, `big-sends`, `style`, `technical`, `speed`, `oldskool`, `contemporary` |
| `environment` | `string`   | `street`, `rooftops`, `nature`, `urbex`, `gym` |
| `filmStyle`   | `string`   | `cinematic`, `street-cinematic`, `skateish`, `raw`, `pov`, `longtakes`, `music-driven`, `montage`, `slowmo`, `gonzo`, `vintage`, `minimalist`, `experimental` |
| `theme`       | `string`   | `journey`, `team`, `event`, `competition`, `educational`, `travel`, `creative`, `entertainment` |

##### `SpotChapter` fields

| Field          | Type     | Always present | Description |
|----------------|----------|----------------|-------------|
| `spotId`       | `string` | ✅             | parkour.spot spot ID. |
| `startSeconds` | `number` | ✅             | Chapter start time in seconds (0-based). |
| `endSeconds`   | `number` | ✅             | Chapter end time in seconds. |
| `playbackKey`  | `string` | No             | For series: the episode playback key (e.g. YouTube video ID). Empty for movies. |

#### Error responses

| Status | Body                          | Meaning |
|--------|-------------------------------|---------|
| 400    | `{ "error": "Invalid id: …" }` | The provided ID is not a valid positive integer. |
| 401    | `{ "error": "Unauthorized" }` | Missing or invalid Bearer token. |
| 404    | `{ "error": "Not found" }`    | No media item exists with this ID. |
| 500    | `{ "error": "…" }`            | Server error. |

---

## Use case: "Bekend van deze video"

parkour.spot can use these endpoints to show, for a given spot, all JumpFlix films/series it has been featured in:

1. Call `GET /api/v1/videos?spotId=<spot_id>` → get all `jumpflixId` values for videos featuring the spot.
2. For each `jumpflixId`, call `GET /api/v1/videos/<jumpflixId>` → get title, thumbnail, URL, and the specific timestamps.
3. Render a "Bekend van deze video" section with links back to JumpFlix.

