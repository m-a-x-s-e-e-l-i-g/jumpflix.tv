// Central content type definitions for the TV page
export interface BaseContent {
  id: number | string;
  title: string;
  description?: string;
  thumbnail?: string;
  blurhash?: string;
  type: 'movie' | 'playlist';
  paid?: boolean;
  provider?: string;
  externalUrl?: string;
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
}

export interface Playlist extends BaseContent {
  type: 'playlist';
  creators?: string[];
  starring?: string[];
  playlistId?: string; // YouTube playlist id
  videoCount?: number;
}

export type ContentItem = Movie | Playlist;

export type SortBy =
  | 'default'
  | 'title-asc'
  | 'year-desc'
  | 'year-asc'
  | 'duration-asc'
  | 'duration-desc';

export interface TvState {
  searchQuery: string;
  showPaid: boolean; // show paid content
  sortBy: SortBy;
}

export const DEFAULT_TV_STATE: TvState = {
  searchQuery: '',
  showPaid: true,
  sortBy: 'default'
};
