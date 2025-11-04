import { supabase } from '$lib/supabaseClient';
import type { Database } from '$lib/supabase/types';

type Rating = Database['public']['Tables']['ratings']['Row'];
type RatingInsert = Database['public']['Tables']['ratings']['Insert'];

/**
 * Get the current user's rating for a specific media item
 */
export async function getUserRating(mediaId: number | string): Promise<number | null> {
	if (!supabase) return null;

	const numericId = typeof mediaId === 'string' ? parseInt(mediaId, 10) : mediaId;
	if (isNaN(numericId)) {
		console.error('Invalid media ID:', mediaId);
		return null;
	}

	try {
		const {
			data: { user }
		} = await supabase.auth.getUser();
		if (!user) return null;

		const { data, error } = await supabase
			.from('ratings')
			.select('rating')
			.eq('media_id', numericId)
			.eq('user_id', user.id)
			.maybeSingle();

		if (error) {
			// Suppress common "not found" errors
			if (error.code === 'PGRST116' || error.message?.includes('406')) return null;
			console.error('Error fetching user rating:', error);
			return null;
		}

		return data?.rating ?? null;
	} catch (error) {
		// Silently return null for common errors
		return null;
	}
}

/**
 * Save or update the current user's rating for a media item
 */
export async function saveRating(mediaId: number | string, rating: number): Promise<void> {
	if (!supabase) throw new Error('Supabase client not initialized');

	const numericId = typeof mediaId === 'string' ? parseInt(mediaId, 10) : mediaId;
	if (isNaN(numericId)) {
		throw new Error('Invalid media ID');
	}

	if (rating < 1 || rating > 10) {
		throw new Error('Rating must be between 1 and 10');
	}

	const {
		data: { user }
	} = await supabase.auth.getUser();
	if (!user) throw new Error('User must be authenticated to rate');

	const ratingData: RatingInsert = {
		user_id: user.id,
		media_id: numericId,
		rating
	};

	const { error } = await supabase
		.from('ratings')
		.upsert(ratingData, {
			onConflict: 'user_id,media_id'
		})
		.select()
		.single();

	if (error) {
		console.error('Error saving rating:', error);
		throw new Error('Failed to save rating');
	}
}

/**
 * Delete the current user's rating for a media item
 */
export async function deleteRating(mediaId: number | string): Promise<void> {
	if (!supabase) throw new Error('Supabase client not initialized');

	const numericId = typeof mediaId === 'string' ? parseInt(mediaId, 10) : mediaId;
	if (isNaN(numericId)) {
		throw new Error('Invalid media ID');
	}

	const {
		data: { user }
	} = await supabase.auth.getUser();
	if (!user) throw new Error('User must be authenticated');

	const { error } = await supabase
		.from('ratings')
		.delete()
		.eq('media_id', numericId)
		.eq('user_id', user.id);

	if (error) {
		console.error('Error deleting rating:', error);
		throw new Error('Failed to delete rating');
	}
}

/**
 * Get the average rating and rating count for a media item
 */
export async function getMediaRatingSummary(
	mediaId: number | string
): Promise<{ averageRating: number; ratingCount: number } | null> {
	if (!supabase) return null;

	const numericId = typeof mediaId === 'string' ? parseInt(mediaId, 10) : mediaId;
	if (isNaN(numericId)) {
		console.error('Invalid media ID:', mediaId);
		return null;
	}

	try {
		const { data, error } = await supabase
			.from('media_ratings_summary')
			.select('average_rating, rating_count')
			.eq('media_id', numericId)
			.maybeSingle();

		if (error) {
			// Suppress common "not found" errors - return empty summary
			if (error.code === 'PGRST116' || error.message?.includes('406')) {
				return { averageRating: 0, ratingCount: 0 };
			}
			console.error('Error fetching rating summary:', error);
			return { averageRating: 0, ratingCount: 0 };
		}

		// If no data, return empty summary (no ratings yet)
		if (!data) {
			return { averageRating: 0, ratingCount: 0 };
		}

		return {
			averageRating: data.average_rating ?? 0,
			ratingCount: data.rating_count ?? 0
		};
	} catch (error) {
		// Silently return empty summary for any errors
		return { averageRating: 0, ratingCount: 0 };
	}
}

/**
 * Get all ratings for a media item (for admin/analytics)
 */
export async function getAllRatingsForMedia(mediaId: number | string): Promise<Rating[]> {
	if (!supabase) return [];

	const numericId = typeof mediaId === 'string' ? parseInt(mediaId, 10) : mediaId;
	if (isNaN(numericId)) {
		console.error('Invalid media ID:', mediaId);
		return [];
	}

	try {
		const { data, error } = await supabase
			.from('ratings')
			.select('*')
			.eq('media_id', numericId)
			.order('created_at', { ascending: false });

		if (error) throw error;

		return data || [];
	} catch (error) {
		console.error('Error fetching all ratings:', error);
		return [];
	}
}
