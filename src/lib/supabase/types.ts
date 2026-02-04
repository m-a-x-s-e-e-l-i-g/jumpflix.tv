export type Json =
	| string
	| number
	| boolean
	| null
	| { [key: string]: Json | undefined }
	| Json[];


export type Database = {
	public: {
		Tables: {
			user_preferences: {
				Row: {
					user_id: string;
					marketing_opt_in: boolean;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					user_id: string;
					marketing_opt_in?: boolean;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					user_id?: string;
					marketing_opt_in?: boolean;
					created_at?: string;
					updated_at?: string;
				};
				Relationships: [];
			};
			watch_history: {
				Row: {
					user_id: string;
					media_id: string;
					media_type: 'movie' | 'series' | 'episode';
					position_seconds: number;
					duration_seconds: number;
					percent_watched: number;
					is_watched: boolean;
					status: 'active' | 'cleared';
					watched_at: string;
					updated_at: string;
					metadata: Json;
				};
				Insert: {
					user_id: string;
					media_id: string;
					media_type: 'movie' | 'series' | 'episode';
					position_seconds?: number;
					duration_seconds?: number;
					percent_watched?: number;
					is_watched?: boolean;
					status?: 'active' | 'cleared';
					watched_at?: string;
					updated_at?: string;
					metadata?: Json;
				};
				Update: {
					user_id?: string;
					media_id?: string;
					media_type?: 'movie' | 'series' | 'episode';
					position_seconds?: number;
					duration_seconds?: number;
					percent_watched?: number;
					is_watched?: boolean;
					status?: 'active' | 'cleared';
					watched_at?: string;
					updated_at?: string;
					metadata?: Json;
				};
				Relationships: [
					{
						foreignKeyName: 'watch_history_user_id_fkey';
						columns: ['user_id'];
						referencedRelation: 'users';
						referencedColumns: ['id'];
					}
				];
			};
			media_items: {
				Row: {
					id: number;
					slug: string;
					type: 'movie' | 'series';
					title: string;
					description: string | null;
					thumbnail: string | null;
					blurhash: string | null;
					paid: boolean | null;
					provider: string | null;
					external_url: string | null;
					year: string | null;
					duration: string | null;
					video_id: string | null;
					vimeo_id: string | null;
					trakt: string | null;
					creators: string[] | null;
					starring: string[] | null;
					facet_type: 'fiction' | 'documentary' | 'session' | 'event' | 'tutorial' | null;
					facet_mood: string[] | null;
					facet_movement: string[] | null;
					facet_environment: 'street' | 'rooftops' | 'nature' | 'urbex' | 'gym' | null;
					facet_film_style: 'cinematic' | 'skateish' | 'raw' | 'pov' | 'longtakes' | null;
					facet_theme: 'journey' | 'team' | 'event' | 'competition' | 'educational' | 'travel' | 'creative' | 'entertainment' | null;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: number;
					slug: string;
					type: 'movie' | 'series';
					title: string;
					description?: string | null;
					thumbnail?: string | null;
					blurhash?: string | null;
					paid?: boolean | null;
					provider?: string | null;
					external_url?: string | null;
					year?: string | null;
					duration?: string | null;
					video_id?: string | null;
					vimeo_id?: string | null;
					trakt?: string | null;
					creators?: string[] | null;
					starring?: string[] | null;
					facet_type?: 'fiction' | 'documentary' | 'session' | 'event' | 'tutorial' | null;
					facet_mood?: string[] | null;
					facet_movement?: string[] | null;
					facet_environment?: 'street' | 'rooftops' | 'nature' | 'urbex' | 'gym' | null;
					facet_film_style?: 'cinematic' | 'skateish' | 'raw' | 'pov' | 'longtakes' | null;
					facet_theme?: 'journey' | 'team' | 'event' | 'competition' | 'educational' | 'travel' | 'creative' | 'entertainment' | null;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: number;
					slug?: string;
					type?: 'movie' | 'series';
					title?: string;
					description?: string | null;
					thumbnail?: string | null;
					blurhash?: string | null;
					paid?: boolean | null;
					provider?: string | null;
					external_url?: string | null;
					year?: string | null;
					duration?: string | null;
					video_id?: string | null;
					vimeo_id?: string | null;
					trakt?: string | null;
					creators?: string[] | null;
					starring?: string[] | null;
					facet_type?: 'fiction' | 'documentary' | 'session' | 'event' | 'tutorial' | null;
					facet_mood?: string[] | null;
					facet_movement?: string[] | null;
					facet_environment?: 'street' | 'rooftops' | 'nature' | 'urbex' | 'gym' | null;
					facet_film_style?: 'cinematic' | 'skateish' | 'raw' | 'pov' | 'longtakes' | null;
					facet_theme?: 'journey' | 'team' | 'event' | 'competition' | 'educational' | 'travel' | 'creative' | 'entertainment' | null;
					created_at?: string;
					updated_at?: string;
				};
				Relationships: [];
			};
			series_seasons: {
				Row: {
					id: number;
					series_id: number;
					season_number: number;
					playlist_id: string | null;
					custom_name: string | null;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: number;
					series_id: number;
					season_number: number;
					playlist_id?: string | null;
					custom_name?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: number;
					series_id?: number;
					season_number?: number;
					playlist_id?: string | null;
					custom_name?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'series_seasons_series_id_fkey';
						columns: ['series_id'];
						referencedRelation: 'media_items';
						referencedColumns: ['id'];
					}
				];
			};
			series_episodes: {
				Row: {
					id: number;
					season_id: number;
					episode_number: number;
					video_id: string | null;
					title: string | null;
					description: string | null;
					published_at: string | null;
					thumbnail: string | null;
					duration: string | null;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: number;
					season_id: number;
					episode_number: number;
					video_id?: string | null;
					title?: string | null;
					description?: string | null;
					published_at?: string | null;
					thumbnail?: string | null;
					duration?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: number;
					season_id?: number;
					episode_number?: number;
					video_id?: string | null;
					title?: string | null;
					description?: string | null;
					published_at?: string | null;
					thumbnail?: string | null;
					duration?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'series_episodes_season_id_fkey';
						columns: ['season_id'];
						referencedRelation: 'series_seasons';
						referencedColumns: ['id'];
					}
				];
			};
			songs: {
				Row: {
					id: number;
					spotify_track_id: string;
					spotify_url: string;
					title: string;
					artist: string;
					duration_ms: number | null;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: number;
					spotify_track_id: string;
					spotify_url: string;
					title: string;
					artist: string;
					duration_ms?: number | null;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: number;
					spotify_track_id?: string;
					spotify_url?: string;
					title?: string;
					artist?: string;
					duration_ms?: number | null;
					created_at?: string;
					updated_at?: string;
				};
				Relationships: [];
			};
			video_songs: {
				Row: {
					id: number;
					video_id: number;
					song_id: number;
					start_offset_seconds: number;
					start_timecode: string | null;
					position: number;
					source: 'automation' | 'manual';
					import_source: 'youtube_chapters' | 'youtube_music' | 'mixed' | null;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: number;
					video_id: number;
					song_id: number;
					start_offset_seconds: number;
					start_timecode?: string | null;
					position: number;
					source?: 'automation' | 'manual';
					import_source?: 'youtube_chapters' | 'youtube_music' | 'mixed' | null;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: number;
					video_id?: number;
					song_id?: number;
					start_offset_seconds?: number;
					start_timecode?: string | null;
					position?: number;
					source?: 'automation' | 'manual';
					import_source?: 'youtube_chapters' | 'youtube_music' | 'mixed' | null;
					created_at?: string;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'video_songs_video_id_fkey';
						columns: ['video_id'];
						referencedRelation: 'media_items';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'video_songs_song_id_fkey';
						columns: ['song_id'];
						referencedRelation: 'songs';
						referencedColumns: ['id'];
					}
				];
			};
			ratings: {
				Row: {
					id: number;
					user_id: string;
					media_id: number;
					rating: number;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: number;
					user_id: string;
					media_id: number;
					rating: number;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: number;
					user_id?: string;
					media_id?: number;
					rating?: number;
					created_at?: string;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'ratings_user_id_fkey';
						columns: ['user_id'];
						referencedRelation: 'users';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'ratings_media_id_fkey';
						columns: ['media_id'];
						referencedRelation: 'media_items';
						referencedColumns: ['id'];
					}
				];
			};
		};
		Views: {
			media_ratings_summary: {
				Row: {
					media_id: number;
					rating_count: number;
					average_rating: number;
				};
				Relationships: [];
			};
			media_facets_view: {
				Row: {
					id: number;
					slug: string;
					title: string;
					type: 'movie' | 'series';
					facet_type: 'fiction' | 'documentary' | 'session' | 'event' | 'tutorial' | null;
					facet_mood: string[] | null;
					facet_movement: string[] | null;
					facet_environment: 'street' | 'rooftops' | 'nature' | 'urbex' | 'gym' | null;
					facet_film_style: 'cinematic' | 'skateish' | 'raw' | 'pov' | 'longtakes' | null;
					facet_theme: 'journey' | 'team' | 'event' | 'competition' | 'educational' | 'travel' | 'creative' | 'entertainment' | null;
					facet_length: 'short' | 'medium' | 'feature' | 'long-feature' | null;
					facet_era: '2000s' | '2010s' | '2020s' | '2030s' | 'pre-2000' | null;
				};
				Relationships: [];
			};
		};
		Functions: {
			delete_user_account: {
				Args: Record<string, never>;
				Returns: undefined;
			};
			user_stats_overview: {
				Args: { target_user: string };
				Returns: {
					found: boolean;
					username: string | null;
					ratings_count: number;
					average_rating: number;
					watched_items: number;
					watched_movies: number;
					watched_series: number;
					watched_episodes: number;
					total_position_seconds: number;
					total_duration_seconds: number;
					avg_percent_watched: number;
					catalog_movies: number;
					catalog_episodes: number;
				};
			};
			user_ratings_distribution: {
				Args: { target_user: string };
				Returns: {
					rating: number;
					count: number;
				}[];
			};
			user_rated_media: {
				Args: { target_user: string };
				Returns: {
					media_id: number;
					rating: number;
					updated_at: string;
					type: string;
					title: string;
					slug: string;
				}[];
			};
			user_watched_not_rated: {
				Args: { target_user: string; limit_n?: number };
				Returns: {
					id: number;
					type: string;
					title: string;
					slug: string;
					last_watched: string;
				}[];
			};
			admin_stats_overview: {
				Args: Record<string, never>;
				Returns: {
					total_users: number;
					users_signed_in_last_15m: number;
					users_signed_in_last_24h: number;
					ratings_count: number;
					average_rating: number;
					watch_history_rows: number;
					watch_users: number;
					watched_items: number;
					total_position_seconds: number;
					total_duration_seconds: number;
					avg_percent_watched: number;
				};
			};
			admin_watch_activity: {
				Args: { days?: number };
				Returns: {
					day: string;
					active_users: number;
					updates: number;
					watched_updates: number;
				}[];
			};
			admin_ratings_distribution: {
				Args: Record<string, never>;
				Returns: {
					rating: number;
					count: number;
				}[];
			};
			admin_top_watched_media: {
				Args: { limit_n?: number };
				Returns: {
					media_id: string;
					media_type: string;
					watchers: number;
					avg_percent: number;
				}[];
			};
		};
		Enums: {};
		CompositeTypes: {};
	};
};
