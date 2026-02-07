import { fetchAllContent } from '$lib/server/content-service';
import { isAdminUser } from '$lib/server/admin';

export const load = async ({ locals }) => {
	// Get the authenticated session using safe method that validates JWT
	const { session, user } = await locals.safeGetSession();
	
	try {
		const content = await fetchAllContent();
		
		// Ensure content is JSON serializable by using JSON.parse(JSON.stringify())
		const serializedContent = JSON.parse(JSON.stringify(content));

		return { 
			content: serializedContent,
			// Pass session and user to all pages for auth state
			session,
			user,
			isAdmin: isAdminUser(user)
		};
	} catch (error) {
		console.error('[+layout.server] Error in load function:', error);
		return { 
			content: [],
			session,
			user,
			isAdmin: isAdminUser(user)
		};
	}
};
