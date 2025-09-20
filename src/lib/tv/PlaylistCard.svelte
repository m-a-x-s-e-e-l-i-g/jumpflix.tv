<script lang="ts">
  import type { Series, ContentItem } from './types';
  import ContentCard from './ContentCard.svelte';
  export let item: Series;
  export let isSelected = false;
  export let isMobile = false;
  export let onSelect: (item: Series) => void;
</script>

<ContentCard {item} {isSelected} {isMobile} onSelect={(i: ContentItem) => onSelect(i as Series)} />
