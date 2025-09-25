// Minimal types for PWA install events not included in lib.dom.d.ts yet
// See: https://developer.mozilla.org/en-US/docs/Web/API/BeforeInstallPromptEvent
interface BeforeInstallPromptEvent extends Event {
  readonly platforms?: string[];
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

declare interface Navigator {
  // iOS Safari exposes this when a PWA is launched from the home screen
  standalone?: boolean;
}
