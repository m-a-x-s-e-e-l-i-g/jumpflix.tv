<script lang="ts">
  import type { Playlist, ContentItem } from './types';
  import ContentCard from './ContentCard.svelte';
  export let item: Playlist;
  export let isSelected = false;
  export let isMobile = false;
  export let onSelect: (item: Playlist) => void;
</script>

<ContentCard {item} {isSelected} {isMobile} onSelect={(i: ContentItem) => onSelect(i as Playlist)} />
