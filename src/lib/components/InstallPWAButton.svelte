<script lang="ts">
  import Button from '$lib/components/ui/Button.svelte';
  import DownloadIcon from '@lucide/svelte/icons/download';
  import { toast } from 'svelte-sonner';
  import { m } from '$lib/paraglide/messages.js';

  // Public props (Svelte 5 runes)
  let { label = 'Install app', className = '' } = $props<{ label?: string; className?: string }>();

  let deferred = $state<BeforeInstallPromptEvent | null>(null);
  let isInstalled = $state(false);
  let isiOS = $state(false);

  // Heuristics to detect installed mode across browsers
  function checkInstalled() {
    // Chrome/Edge
    const isStandaloneMq = typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches;
    // iOS Safari
    const isIOSStandalone = typeof navigator !== 'undefined' && (navigator as any).standalone;
    // Firefox/others sometimes set referrer
    const isNavigatorStandalone = (navigator as any).displayMode === 'standalone';
    return Boolean(isStandaloneMq || isIOSStandalone || isNavigatorStandalone);
  }

  $effect(() => {
    if (typeof window === 'undefined') return;

    const onBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault?.();
  deferred = e as BeforeInstallPromptEvent;
  // Update installed state in case it changed
  isInstalled = checkInstalled();
    };

    const onAppInstalled = () => {
      isInstalled = true;
      deferred = null;
  toast.success(m.install_installed());
    };

  // Initial state
  isInstalled = checkInstalled();
  isiOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  // Pick up any early-captured event (from app.html)
  try { deferred = (window as any).__bip ?? null; } catch {}

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt as any);
    window.addEventListener('appinstalled', onAppInstalled as any);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt as any);
      window.removeEventListener('appinstalled', onAppInstalled as any);
    };
  });

  async function triggerInstall() {
    try {
      if (import.meta.env.DEV) {
        toast.message(m.install_dev?.() ?? 'Install prompts only appear on a production build with a registered service worker.');
        // continue so iOS users still get the A2HS hint below
      }
      if (!deferred) {
        // Safari/iOS: show A2HS hint; others: explain install is not yet available
        if (isiOS) toast.message(m.install_hint());
        else toast.message(m.install_not_available?.() ?? 'Install isn\'t available yet. Try reloading once.');
        return;
      }
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === 'accepted') {
        toast.success(m.install_thanks());
      } else {
        toast.message(m.install_dismissed());
      }
      // Reset; on Chrome the event cannot be reused
      deferred = null;
      // Keep showing the button if not installed; user can try again or use A2HS
    } catch (err) {
      console.error(err);
  toast.error(m.install_error());
    }
  }
</script>

{#if !isInstalled}
  <Button variant="destructive" on:click={triggerInstall} className={className}>
    <DownloadIcon class="size-4" />
    <span>{label}</span>
  </Button>
{:else}
  <!-- hidden when installed or cannot install yet -->
{/if}

<style>
  /* no extra styles; uses design system Button */
</style>
