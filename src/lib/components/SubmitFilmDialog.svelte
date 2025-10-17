<script lang="ts">
  import { enhance } from "$app/forms";
  import type { SubmitFunction } from "@sveltejs/kit";
  import { tick } from "svelte";
  import XIcon from "@lucide/svelte/icons/x";
  import { Dialog } from "bits-ui";
  import { toast } from "svelte-sonner";
  import { m } from "$lib/paraglide/messages.js";

  let { label = m.submit_film_dialog_title() } = $props<{ label?: string }>();

  let open = $state(false);
  let formEl: HTMLFormElement | null = null;
  let inputEl: HTMLInputElement | null = null;
  let isSubmitting = $state(false);
  let submitError = $state<string | null>(null);

  const handleEnhance: SubmitFunction = () => {
    return async ({ result, update }) => {
      isSubmitting = false;

      if (result.type === "success") {
        open = false;
        submitError = null;
        formEl?.reset();
        await tick();
        inputEl?.focus();
        toast.message(m.submit_film_success());
        return;
      }

      await update({ invalidateAll: false });

      if (result.type === "failure") {
        submitError = result.data?.message ?? m.submit_film_error_generic();
      } else if (result.type === "error") {
        submitError = m.submit_film_error_network();
      }
    };
  };

  $effect(() => {
    if (!open) return;
    tick().then(() => {
      inputEl?.focus();
    }).catch(() => {});
  });

  function handleSubmit() {
    submitError = null;
    isSubmitting = true;
  }

  function closeDialog() {
    open = false;
  }

  const actionButtonBase =
    "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2 text-sm font-medium uppercase tracking-[0.2em] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-slate-900/40 dark:focus-visible:outline-white/70 disabled:cursor-not-allowed disabled:opacity-60";
</script>

<Dialog.Root bind:open={open}>
  <Dialog.Trigger
    class="group inline-flex items-center gap-3 rounded-full border border-slate-900/10 bg-white/85 px-6 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-900 shadow-[0_14px_28px_-18px_rgba(15,23,42,0.3)] transition hover:border-slate-900/20 hover:bg-white hover:text-slate-900 dark:border-white/30 dark:bg-white/10 dark:text-white/80 dark:hover:border-white/60 dark:hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-900/40 dark:focus-visible:outline-white/70"
  >
    {label}
  </Dialog.Trigger>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 z-40 bg-black/78 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
    <Dialog.Content
      class="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-900/10 bg-background px-6 py-7 text-foreground shadow-[0_40px_80px_-30px_rgba(15,23,42,0.28)] focus:outline-none dark:border-white/10 dark:shadow-[0_40px_80px_-30px_rgba(0,0,0,0.75)]"
      aria-describedby="submit-film-description"
    >
      <button
        type="button"
        class="absolute right-5 top-5 inline-flex size-8 items-center justify-center rounded-full border border-slate-900/10 bg-white/80 text-slate-500 transition hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:text-white dark:focus-visible:ring-white/70 dark:focus-visible:ring-offset-black/20"
        onclick={closeDialog}
      >
        <XIcon class="size-4" />
        <span class="sr-only">{m.submit_film_close()}</span>
      </button>

      <div class="flex flex-col gap-6">
        <header class="space-y-2">
          <Dialog.Title class="text-xl font-semibold text-foreground">{m.submit_film_dialog_title()}</Dialog.Title>
          <p id="submit-film-description" class="text-sm text-muted-foreground">
            {m.submit_film_dialog_description()}
          </p>
        </header>

        <form
          method="POST"
          action="?/submitFilm"
          bind:this={formEl}
          class="space-y-4"
          onsubmit={handleSubmit}
          use:enhance={handleEnhance}
        >
      <label class="space-y-2">
        <span class="text-sm font-medium text-slate-700 dark:text-white/80">{m.submit_film_field_label()}</span>
        <input
          bind:this={inputEl}
          type="text"
          name="submission"
          required
          minlength="3"
          maxlength="300"
          placeholder={m.submit_film_placeholder()}
          class="w-full rounded-xl border border-slate-900/20 bg-white/90 px-4 py-3 text-base text-slate-900 shadow-inner placeholder:text-slate-500 focus:border-[#e50914] focus:outline-none focus:ring-2 focus:ring-[#e50914]/70 dark:border-white/20 dark:bg-white/10 dark:text-white dark:placeholder:text-white/50"
        />
      </label>
      {#if submitError}
        <p class="text-sm text-red-400" role="status" aria-live="polite">{submitError}</p>
      {/if}
          <div class="mt-4 flex flex-col-reverse gap-2 sm:mt-6 sm:flex-row sm:justify-end sm:gap-3">
            <button
              type="button"
              class={`${actionButtonBase} border border-slate-900/15 bg-white/80 text-slate-700 hover:border-slate-900/30 hover:bg-white hover:text-slate-900 dark:border-white/20 dark:bg-white/5 dark:text-white/70 dark:hover:border-white/40 dark:hover:text-white`}
              onclick={closeDialog}
            >
                {m.submit_film_cancel()}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              class={`${actionButtonBase} bg-[#e50914] text-white shadow-[0_12px_32px_-18px_rgba(229,9,20,0.9)] hover:bg-[#ff1a27] disabled:bg-[#e50914]/80`}
            >
              {#if isSubmitting}
                  {m.submit_film_sending()}
              {:else}
                  {m.submit_film_submit()}
              {/if}
            </button>
          </div>
        </form>
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
