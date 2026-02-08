<script lang="ts">
  import '@khmyznikov/pwa-install';
  import { onMount } from 'svelte';

  export let autoOpen = false;

  /** How long (ms) to suppress the dialog after the user dismisses it */
  const SUPPRESS_MS = 10 * 7 * 24 * 60 * 60 * 1000; // 10 weeks
  const STORAGE_KEY = 'pwa-install-dismissed-at';
  let el: HTMLElement | null = null;
  // Allow parent to capture reference
  function dispatchRef() {
    try {
      const event = new CustomEvent('pwa-install-element', { detail: el });
      dispatchEvent(event);
    } catch {}
  }

  // A tiny heuristic to avoid showing inside standalone / already installed contexts
  function isStandalone() {
    return (window.matchMedia('(display-mode: standalone)').matches)
      || (navigator as any).standalone === true; // iOS Safari legacy
  }

  function shouldSuppress(): boolean {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const ts = parseInt(raw, 10);
      if (Number.isNaN(ts)) return false;
      return Date.now() - ts < SUPPRESS_MS;
    } catch { return false; }
  }

  function markDismissed() {
    try { localStorage.setItem(STORAGE_KEY, String(Date.now())); } catch {}
  }

  onMount(() => {
    if (!el) return;

    // If user already installed / in standalone, do nothing
    if (isStandalone()) return;

    // Auto open once the component upgrades (custom element defined)
    let shownTracked = false;
    const trackShown = () => {
      if (shownTracked) return;
      shownTracked = true;
      track('pwa_install_shown', { platform: resolvePlatform(), auto: true, standalone: isStandalone() });
    };

    // Wrap showDialog to track manual triggers too (manual triggers happen outside component also)
    const originalShow = (el as any).showDialog?.bind(el);
    if (originalShow) {
      (el as any).showDialog = (withBackdrop: boolean) => {
        const result = originalShow(withBackdrop);
        trackShown();
        return result;
      };
    }

    const tryOpen = () => {
      if (el && typeof (el as any).showDialog === 'function') {
        (el as any).showDialog(true);
      }
    };

    const shouldAutoOpen = autoOpen && !shouldSuppress();
    if (shouldAutoOpen) {
      // In case install already available, open immediately; otherwise small timeout
      setTimeout(tryOpen, 50);
    }

    const onAnyClose = (e: Event) => {
      // The component doesn't emit a dedicated close event; we watch attribute/state changes
      if ((el as any)?.isDialogHidden) {
        markDismissed();
        // Track dismiss if not already installed success/fail (those tracked separately)
        track('pwa_install_dismiss', { platform: resolvePlatform(), standalone: isStandalone(), user_choice: (el as any)?.userChoiceResult ?? null });
      }
    };

    // Simple analytics helper (Google Analytics gtag if present)
    const track = (name: string, params: Record<string, any> = {}) => {
      try {
        (window as any).gtag?.('event', name, params);
      } catch {}
    };

    const resolvePlatform = () => {
      try {
        if (!el) return 'unknown';
        if ((el as any).isAppleMobilePlatform) return 'apple-mobile';
        if ((el as any).isAppleDesktopPlatform) return 'apple-desktop';
        if (/android/i.test(navigator.userAgent)) return 'android';
        return 'other';
      } catch { return 'unknown'; }
    };

    // Analytics: success
    const successListener = (e: any) => {
      track('pwa_install_success', {
        message: e?.detail?.message || '',
        platform: resolvePlatform(),
        standalone: isStandalone(),
        user_choice: (el as any)?.userChoiceResult ?? null
      });
    };
    // Analytics: fail
    const failListener = (e: any) => {
      track('pwa_install_fail', {
        message: e?.detail?.message || '',
        platform: resolvePlatform(),
        standalone: isStandalone(),
        user_choice: (el as any)?.userChoiceResult ?? null
      });
    };

    // Polling fallback: observe changes to hidden property (cheap interval, stops after hidden once)
    const interval = setInterval(() => {
      if (!el) return;
      // If dialog becomes visible at any point before hidden, we can detect via isDialogHidden false -> shown
      try {
        if (!(el as any).isDialogHidden) {
          trackShown();
        }
      } catch {}
      if ((el as any).isDialogHidden) {
        clearInterval(interval);
        markDismissed();
        track('pwa_install_dismiss', { platform: resolvePlatform(), standalone: isStandalone(), user_choice: (el as any)?.userChoiceResult ?? null });
      }
    }, 1000);

    // Some emitted events we can treat as user interaction endings
    const handler = () => onAnyClose(new Event('pwa-install-close-proxy'));
    el.addEventListener('pwa-install-success-event', handler);
    el.addEventListener('pwa-install-fail-event', handler);
    el.addEventListener('pwa-user-choice-result-event', handler);
    el.addEventListener('pwa-install-success-event', successListener);
    el.addEventListener('pwa-install-fail-event', failListener);

    dispatchRef();

    return () => {
      clearInterval(interval);
      el?.removeEventListener('pwa-install-success-event', handler);
      el?.removeEventListener('pwa-install-fail-event', handler);
      el?.removeEventListener('pwa-user-choice-result-event', handler);
      el?.removeEventListener('pwa-install-success-event', successListener);
      el?.removeEventListener('pwa-install-fail-event', failListener);
    };
  });
</script>

<!--
  manual-* attributes so we control when dialog opens. use-local-storage could be used
  but we want a custom 2 week window (component persists forever otherwise)
-->
<pwa-install
  bind:this={el}
  manual-apple="true"
  manual-chrome="true"
  manifest-url="/manifest.webmanifest"
  use-local-storage="false"
></pwa-install>
