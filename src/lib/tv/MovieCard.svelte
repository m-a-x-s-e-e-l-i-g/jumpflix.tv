<script lang="ts">
  import type { Movie, ContentItem } from './types';
  import ContentCard from './ContentCard.svelte';
  export let item: Movie;
  export let isSelected = false;
  export let isMobile = false;
  export let onSelect: (item: Movie) => void;
</script>

<ContentCard {item} {isSelected} {isMobile} onSelect={(i: ContentItem) => onSelect(i as Movie)} />
