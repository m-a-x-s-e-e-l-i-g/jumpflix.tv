# Athlete profile photos

Apply `20261008200823_add_person_profile_photos.sql` before enabling writes. It adds nullable photo fields and a public `person-photos` bucket restricted to WebP files up to 1 MB. Existing public profile reads remain available before migration. Uploads and profile updates require the server service role and the existing admin allowlist; no public storage write policies are added.

Open `/admin/people/photos`. Choose a saved Instagram handle and import, or upload a JPEG, PNG or WebP up to 5 MB. Images are decoded, oriented, cropped to 512 × 512 and saved as WebP without source metadata. Successful saves disappear from the default missing-only list. Public athlete pages use the stored image with initials as fallback. They never call Instagram.

## Instagram setup

Set these server-only environment variables:

- `INSTAGRAM_ACCESS_TOKEN`: a valid token for Instagram API with Facebook Login with Business Discovery access.
- `INSTAGRAM_BUSINESS_ACCOUNT_ID`: the connected Instagram professional account ID, not a Facebook Page ID.
- `INSTAGRAM_GRAPH_API_VERSION`: the supported Graph API version enabled for your Meta app, e.g. `v24.0`. Configure explicitly and update with your app's supported version.

The caller must have the required Facebook Page/Instagram permissions and any required Meta app review. Follow [Meta's Instagram API documentation](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api) and [Business Discovery reference](https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-user/business_discovery).

Business Discovery can retrieve eligible business and creator profiles. Personal accounts, missing handles, denied access and expired tokens need an upload or a retry after setup. Having a handle does not guarantee API access. “Import missing photos” processes athletes with exactly one saved handle sequentially; several handles require a per-row choice. The queue reports failures and can stop after the current photo. Imports are explicit admin actions; no backfill or scheduled polling runs on deploy.

Only HTTPS photo URLs on Meta CDN subdomains are accepted, including every redirect. Downloads have time and byte limits. Tokens are sent in an authorization header and are never included in public page data or saved image metadata.

## Verification and rollback

Before production rollout, apply the migration to a non-production Supabase project. Verify an unauthorized POST is rejected, upload a real image, import one accessible creator account, confirm the chosen handle and athlete match, and check the public person page on desktop and mobile. Test a personal account and a token failure: the page should offer upload and retain any existing photo. Check that anonymous storage uploads fail.

No production migration or photo import is performed by this change. Reverting the application leaves nullable fields and stored photos harmlessly in place. Older immutable photos are retained so merged profiles and cached pages keep working; storage cleanup can be done separately after checking references.
