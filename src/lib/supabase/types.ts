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
					video_count: number | null;
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
					video_count?: number | null;
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
					video_count?: number | null;
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
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: number;
					series_id: number;
					season_number: number;
					playlist_id?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: number;
					series_id?: number;
					season_number?: number;
					playlist_id?: string | null;
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
		};
		Functions: {};
		Enums: {};
	};
}
