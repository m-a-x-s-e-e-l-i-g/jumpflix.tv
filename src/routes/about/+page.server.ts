import type { PageServerLoad } from './$types';
import { loadPublicFundingData } from '$lib/server/funding';

export const load: PageServerLoad = async () => {
    const funding = await loadPublicFundingData();

    return {
        fundingSummary: funding.summary,
        fundingAvailable: funding.available
    };
};