import {useSyncExternalStore} from 'react';

/** Everything the showcase shows is made up; the team is "loaded" from a pretend server. */

export type Person = {
  readonly name: string;
  readonly initials: string;
  readonly color: string;
  readonly role: string;
};

export const people = {
  maya: {name: 'Maya Chen', initials: 'MC', color: '#b45309', role: 'Product designer'},
  leo: {name: 'Leo Park', initials: 'LP', color: '#047857', role: 'Engineer'},
  ava: {name: 'Ava Rossi', initials: 'AR', color: '#be185d', role: 'Marketing lead'},
  sam: {name: 'Sam Okafor', initials: 'SO', color: '#0369a1', role: 'Engineering manager'},
  noah: {name: 'Noah Weber', initials: 'NW', color: '#6d28d9', role: 'Engineer'},
} satisfies Record<string, Person>;

export const stats = [
  {label: 'Active projects', value: '12', trend: '+2 this month'},
  {label: 'Tasks completed', value: '148', trend: '+18% vs last week'},
  {label: 'On-time delivery', value: '94%', trend: '+3 pts'},
] as const;

/** Tasks completed per day, Monday to Sunday. */
export const weeklyTasks = [14, 22, 19, 29, 34, 17, 13] as const;

export type Project = {readonly name: string; readonly progress: number; readonly due: string};

export const projects: readonly Project[] = [
  {name: 'Website redesign', progress: 72, due: 'Oct 30'},
  {name: 'Mobile app 2.0', progress: 45, due: 'Nov 14'},
  {name: 'Q4 launch campaign', progress: 90, due: 'Oct 22'},
  {name: 'Customer portal', progress: 18, due: 'Dec 5'},
];

export const activity = [
  {person: people.maya, action: 'completed', subject: 'Homepage hero', project: 'Website redesign', time: '2m'},
  {person: people.leo, action: 'commented on', subject: 'Onboarding flow', project: 'Mobile app 2.0', time: '14m'},
  {person: people.ava, action: 'uploaded', subject: '3 files', project: 'Q4 launch campaign', time: '1h'},
  {person: people.sam, action: 'created', subject: 'Customer portal', project: 'Projects', time: '3h'},
] as const;

type TeamState = {readonly members: readonly Person[]; readonly isLoading: boolean};

/** How long the pretend server takes to answer. */
const serverMs = 900;

let team: TeamState = {members: [], isLoading: false};
let pending: Promise<void> | undefined;
const listeners = new Set<() => void>();

function update(next: TeamState): void {
  team = next;
  for (const listener of listeners) {
    listener();
  }
}

/** Loads the team again; resolves once it is there. Calls while a load is running share it. */
export async function loadTeam(): Promise<void> {
  pending ??= (async () => {
    update({...team, isLoading: true});
    await new Promise((resolve) => {
      setTimeout(resolve, serverMs);
    });
    update({members: Object.values(people), isLoading: false});
    pending = undefined;
  })();
  return pending;
}

export function useTeam(): TeamState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => team,
    () => team,
  );
}
