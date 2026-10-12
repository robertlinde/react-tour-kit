import {useSyncExternalStore} from 'react';

/** Recent orders, as if from a server: refreshing them takes a moment. */
export type Order = {readonly id: number; readonly table: string; readonly items: string};

type OrdersState = {readonly orders: readonly Order[]; readonly isLoading: boolean};

const sampleOrders: readonly Order[] = [
  {id: 1, table: 'Table 4', items: '2 × Pasta, 1 × Salad'},
  {id: 2, table: 'Table 7', items: '3 × Pizza'},
  {id: 3, table: 'Terrace 2', items: '1 × Soup, 2 × Lemonade'},
];

/** How long the demo's "server" takes to answer. */
const serverMs = 1500;

let state: OrdersState = {orders: sampleOrders, isLoading: false};
const listeners = new Set<() => void>();

function update(next: OrdersState): void {
  state = next;
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Loads the orders again; resolves once they are there. */
export async function refreshOrders(): Promise<void> {
  update({...state, isLoading: true});
  await new Promise((resolve) => {
    setTimeout(resolve, serverMs);
  });
  update({orders: sampleOrders, isLoading: false});
}

export function useOrders(): OrdersState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
}
