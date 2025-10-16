/// <reference types="svelte" />
/// <reference types="vite/client" />

declare module "$env/static/private" {
  export const TELEGRAM_BOT_TOKEN: string;
  export const TELEGRAM_CHANNEL_ID: string;
}
