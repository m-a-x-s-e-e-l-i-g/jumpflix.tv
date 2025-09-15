<script lang="ts">
    export let variant: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' = 'primary';
    export let size: 'xs' | 'sm' | 'md' | 'lg' = 'md';
    export let full: boolean = false;
    export let type: 'button' | 'submit' | 'reset' = 'button';
    export let disabled: boolean = false;
    export let className: string = '';

  const variantClasses: Record<string,string> = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/90',
    outline: 'border border-border bg-background hover:bg-muted/40',
    ghost: 'hover:bg-muted/40',
    destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
  };
  const sizeClasses: Record<string,string> = {
    xs: 'h-7 px-2 text-xs',
    sm: 'h-8 px-3 text-sm',
    md: 'h-9 px-4 text-sm',
    lg: 'h-11 px-6 text-base'
  };

    $: classes = [
      'inline-flex items-center justify-center gap-2 font-medium rounded-md transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
      'disabled:opacity-50 disabled:pointer-events-none',
      variantClasses[variant],
      sizeClasses[size],
      full ? 'w-full' : '',
      className
    ].filter(Boolean).join(' ');
</script>

<button {type} {disabled} class={classes}>
  <slot />
</button>
