import { env } from '$env/dynamic/private';

/**
 * Validates the Bearer token from the Authorization header.
 * Checks against the PARKOUR_SPOT_BEARER_TOKEN environment variable.
 *
 * @returns true if the token is valid, false otherwise.
 */
export function validateBearerToken(authHeader: string | null): boolean {
	const token = env.PARKOUR_SPOT_BEARER_TOKEN?.trim();
	if (!token) return false;
	if (!authHeader?.startsWith('Bearer ')) return false;
	return authHeader.slice(7) === token;
}
