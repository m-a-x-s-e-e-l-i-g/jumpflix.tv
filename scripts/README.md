# JumpFlix Admin Scripts

Interactive command-line tools for managing your JumpFlix database.

## Setup

1. **Create `.env` file** with your Supabase credentials:

```bash
PUBLIC_SUPABASE_URL=https://your-project.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional: Spotify (needed for tracklists)
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
```

> **Note:** The CLI will work with the anon key, but using the service role key gives you admin privileges and bypasses RLS policies.

1. **Install dependencies** (if you haven't already):

```bash
npm install
```

## Usage

### Admin CLI

Run the admin CLI for content management:

```bash
npm run admin
```

### Database Backup

Run the backup tool:

```bash
npm run backup
```

## Admin CLI Features

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

### 🎵 Manage Tracklists (Spotify-backed)

Add and maintain timestamped song tracklists for movies.

- **Manual add**: paste a Spotify track URL/URI and enter a start timecode
- **Import from YouTube (best-effort)**: uses video description timestamps and/or “Music in this video” attribution
- **Bulk import**: imports missing tracklists for all movies with 0 tracks

This feature requires `SPOTIFY_CLIENT_ID` + `SPOTIFY_CLIENT_SECRET` in `.env`.

## Database Backup Tool Features

The backup tool creates complete local backups of your Supabase database.

### Backup Types

- **📦 Complete backup** - Schema + Data + Users + Migrations (recommended)
- **📋 Schema only** - Database structure (DDL)
- **💾 Data only** - All table data (DML)
- **👥 Users only** - Supabase Auth users (JSON export)
- **📁 Migrations only** - Copy of all migration files
- **⚙️ Custom backup** - Choose what to include

### What's Backed Up

**Schema (DDL):**

- Complete table definitions from migrations
- Column types and constraints
- Indexes and primary keys
- RLS policies and security rules
- Combines all migration files into single file
- Fallback introspection if migrations unavailable

**Data (DML):**

- All rows from all tables
- Formatted as SQL INSERT statements
- Handles JSON, arrays, and special types
- Safe string escaping

**Users (Auth):**

- All users from Supabase Auth
- Exported as JSON format
- Includes user metadata
- Email, phone, and authentication details
- Restore via Auth Admin API or dashboard

**Migrations:**

- All `.sql` migration files from `supabase/migrations/`

### Backup Output

Each backup creates a timestamped directory with:

```text
backups/
└── backup_2025-11-05_14-30-00/
    ├── README.md           # Restore instructions
    ├── backup-info.json    # Backup metadata
    ├── schema.sql          # Database schema
    ├── data.sql           # All table data
    ├── users.sql          # Auth users (JSON)
    └── migrations/        # Migration files
        ├── 202510310001_initial_schema.sql
        ├── 20251103120000_add_watch_history.sql
        └── ...
```

### Restore Instructions

1. **Restore Schema:**

   ```bash
   psql -h your-db-host -U your-user -d your-database -f schema.sql
   ```

2. **Restore Data:**

   ```bash
   psql -h your-db-host -U your-user -d your-database -f data.sql
   ```

3. **Restore Users:**
   
   Users are exported as JSON. Use Supabase dashboard or Auth Admin API to import.
   See `users.sql` for the JSON data and detailed instructions.

4. **Apply Migrations:**
   Run migration files in order from the `migrations/` directory

### Configuration

- **Default output:** `./backups/` directory
- **Custom output:** Choose any directory during backup
- **Automatic timestamping:** Each backup gets a unique timestamp

### Important Notes

- Backups include all public schema tables
- **User data requires service role key** - Auth Admin API access needed
- **Keep backups secure** - they contain sensitive user data including emails
- Test restores in non-production first
- Backups are stored locally (not in git)
- Service role key required for complete backups
- User passwords are hashed and handled securely

## Admin CLI Important Notes

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
- **Back up regularly** - Run `npm run backup` before major changes

## Security

⚠️ These tools are meant for **local admin use only**. Never commit your `.env` file or expose your service role key.

The `.env` file is already in `.gitignore` to prevent accidental commits.
