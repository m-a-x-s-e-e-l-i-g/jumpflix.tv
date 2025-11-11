export type Json =
	| string
	| number
	| boolean
	| null
	| { [key: string]: Json | undefined }
	| Json[];

export interface Database {
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
			};
		};
		Functions: {};
		Enums: {};
	};
}
