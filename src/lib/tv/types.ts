// Central content type definitions for the TV page

// Facet type definitions
export type FacetType = 'fiction' | 'documentary' | 'session' | 'event' | 'tutorial';
export type FacetMood = 'energetic' | 'chill' | 'gritty' | 'wholesome' | 'artistic';
export type FacetMovement = 'flow' | 'big-sends' | 'style' | 'technical' | 'speed' | 'oldskool' | 'contemporary';
export type FacetEnvironment = 'street' | 'rooftops' | 'nature' | 'urbex' | 'gym';
export type FacetFilmStyle = 'cinematic' | 'street-cinematic' | 'skateish' | 'raw' | 'pov' | 'longtakes' | 'music-driven' | 'montage' | 'slowmo' | 'gonzo' | 'vintage' | 'minimalist' | 'experimental';
export type FacetTheme = 'journey' | 'team' | 'event' | 'competition' | 'educational' | 'travel' | 'creative' | 'entertainment';
export type FacetEra = '2000s' | '2010s' | '2020s' | '2030s' | 'pre-2000';

export interface Facets {
  type?: FacetType;
  mood?: FacetMood[];
  movement?: FacetMovement[];
  environment?: FacetEnvironment;
  filmStyle?: FacetFilmStyle;
  theme?: FacetTheme;
  era?: FacetEra; // Auto-calculated from year
}

export interface BaseContent {
  id: number | string;
  slug: string;
  title: string;
  description?: string;
  thumbnail?: string;
  blurhash?: string;
  type: 'movie' | 'series';
  paid?: boolean;
  provider?: string;
  externalUrl?: string;
  averageRating?: number;
  ratingCount?: number;
  facets?: Facets;
  createdAt?: string;
  updatedAt?: string;
}

export interface Movie extends BaseContent {
  type: 'movie';
  year?: string;
  duration?: string; // e.g. "1h 12m" or "40m"
  videoId?: string; // YouTube
  vimeoId?: string; // Vimeo
  trakt?: string; // external metadata link
  creators?: string[];
  starring?: string[];
  tracks?: VideoTrack[]; // Optional Spotify-backed tracklist
}

export interface Series extends BaseContent {
  type: 'series';
  trakt?: string; // external metadata link
  creators?: string[];
  starring?: string[];
  seasons: Season[]; // Each season must have a playlistId
  episodeCount?: number; // Total episode count across all seasons (dynamically queried)
}

export type ContentItem = Movie | Series;

export interface Song {
  spotifyTrackId: string;
  spotifyUrl: string;
  title: string;
  artist: string;
  durationMs?: number;
}

export interface VideoTrack {
  position: number;
  startAtSeconds?: number;
  startTimecode?: string;
  source: 'automation' | 'manual';
  importSource?: 'youtube_chapters' | 'youtube_music' | 'mixed';
  song: Song;
}

// Episode/Season model (minimal for now)
export interface Episode {
  id: string; // YouTube video id (or other identifier for external content)
  title: string;
  description?: string;
  publishedAt?: string; // ISO date
  thumbnail?: string; // best-effort thumbnail URL
  position?: number; // episode number within season (1-based)
  duration?: string; // optional, may be unknown without extra API
  externalUrl?: string; // External URL for episodes not on YouTube (paid content)
}

export interface Season {
  id?: number; // Database ID for the season
  seasonNumber: number; // 1-based index
  playlistId?: string; // Optional YouTube playlist backing this season
  customName?: string; // Optional custom display name (e.g., "Competition Year 2023", "Extras")
  episodes?: Episode[]; // optional cache
}

export type SortBy =
  | 'default'
  | 'added-desc'
  | 'title-asc'
  | 'year-desc'
  | 'year-asc'
  | 'duration-asc'
  | 'duration-desc'
  | 'rating-desc'
  | 'rating-asc';

export interface TvState {
  searchQuery: string;
  showPaid: boolean; // show paid content
  sortBy: SortBy;
  showWatched?: boolean;
  watchedBaseIds?: Set<string>;
  inProgressBaseIds?: Set<string>;
}

export const DEFAULT_TV_STATE: TvState = {
  searchQuery: '',
  showPaid: true,
  sortBy: 'default',
  showWatched: true
};
