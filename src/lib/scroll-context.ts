export type ScrollSubscriber = (scrollY: number) => void;

export type ScrollSubscription = (subscriber: ScrollSubscriber) => () => void;

export const SCROLL_CONTEXT_KEY = Symbol('jumpflix-scroll');
