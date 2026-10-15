import type {TourStep} from '@robertlinde/react-tour-kit/react';
import {loadTeam} from './data.ts';

/**
 * The showcase's onboarding tour. Every step first opens the page it needs, so the tour also works
 * when going back. The tour waits for each target to appear and scrolls it into view by itself.
 */
export function createShowcaseTour(open: (path: string) => void): TourStep[] {
  const on = (path: string, step: TourStep): TourStep => ({
    ...step,
    onBeforeStep() {
      open(path);
    },
  });

  return [
    on('/', {
      title: 'Welcome to Acme 👋',
      content: 'Take a 20-second look around your new workspace.',
    }),
    on('/', {
      target: '[data-tour="search"]',
      title: 'Find anything',
      content: 'Search projects, files and people from anywhere.',
    }),
    on('/', {
      target: '[data-tour="new-project"]',
      title: 'Start something new',
      content: 'Spin up a project in seconds, templates included.',
    }),
    on('/', {
      target: '[data-tour="activity"]',
      title: 'Stay in the loop',
      content: 'Every update from your team, in one feed.',
      placement: 'top',
    }),
    {
      target: '[data-tour="invite"]',
      title: 'Bring your team',
      content: 'Invite teammates. They get a tour like this one.',
      // Loading takes a moment: meanwhile the tour dims the screen and shows a spinner.
      async onBeforeStep() {
        open('/team');
        await loadTeam();
      },
    },
    on('/', {
      target: '[data-tour="help"]',
      title: 'Help is always here',
      content: 'Replay this tour any time from Help.',
    }),
  ];
}
