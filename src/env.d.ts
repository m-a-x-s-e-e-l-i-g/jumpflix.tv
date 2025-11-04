/// <reference types="svelte" />
/// <reference types="vite/client" />

declare module "$env/static/private" {
  export const TELEGRAM_BOT_TOKEN: string;
  export const TELEGRAM_CHANNEL_ID: string;
  export const SUPABASE_SERVICE_ROLE_KEY: string;
}

declare module "$env/static/public" {
  export const PUBLIC_SUPABASE_URL: string;
  export const PUBLIC_SUPABASE_ANON_KEY: string;
}
