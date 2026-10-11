import type {TourStep} from '@robertlinde/react-tour-kit/react';

/**
 * A tour across two pages. Every step first opens the page it needs, so the tour also works when
 * going back. That is all `onBeforeStep` does: the tour waits for the target to appear by itself,
 * scrolls it into view (including nested scroll containers) and keeps everything on screen.
 */
export function createDemoTour(navigate: (path: string) => void): TourStep[] {
  /** Opens `path` unless it is already open (no duplicate history entries when steps repeat it). */
  const open = (path: string): void => {
    if (globalThis.location.pathname !== path) {
      navigate(path);
    }
  };

  const on = (path: string, step: TourStep): TourStep => ({
    ...step,
    onBeforeStep() {
      open(path);
    },
  });

  return [
    on('/', {
      title: 'Welcome to react-tour-kit',
      content: 'Steps without a target are shown in the centre. Use the arrow keys, or the buttons below.',
    }),
    on('/', {
      target: '[data-tour="header"]',
      title: 'Highlight anything',
      content: 'The highlighted element stays fully visible, and the tooltip never leaves the screen.',
    }),
    on('/', {
      target: '[data-tour="feature-1"]',
      title: 'Smart placement',
      content: 'Asked for the right side; flips automatically when there is no room.',
      placement: 'right',
    }),
    on('/', {
      target: '[data-tour="install"]',
      title: 'Below the fold',
      content: 'Targets outside the viewport are scrolled into view, clear of the sticky navigation.',
      placement: 'top',
    }),
    on('/settings', {
      target: '[data-tour="settings-header"]',
      title: 'Across pages',
      content: 'onBeforeStep navigated here. The tour waited for this page to render—no polling needed.',
    }),
    on('/settings', {
      target: '[data-tour="theme-toggle"]',
      title: 'Theme it',
      content: 'Colours come from the theme prop. Try the dark theme in the navigation.',
      placement: 'right',
    }),
    on('/settings', {
      target: '[data-tour="advanced"]',
      title: 'Nested scrollers',
      content: 'This option sits deep inside a scrollable panel; the panel was scrolled for you.',
    }),
    on('/', {
      target: '[data-tour="cta"]',
      title: "That's it!",
      content: 'Back on the home page. Finish closes the tour and gives focus back to this button.',
      placement: 'top',
    }),
  ];
}
