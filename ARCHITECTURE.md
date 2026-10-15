# Architecture

react-tour-kit runs on the web and on React Native from one codebase. The design goal: **the platforms cannot drift apart.** Everything a tour _does_ is written once; each platform only supplies raw facts and drawing primitives, through two typed ports. This page explains where code goes and how to add a feature so that no platform is forgotten.

## The layers

```
                 ┌─────────────────────────────────────────────┐
  shared         │ engine          steps, phases, callbacks     │  src/shared/engine
  (one copy,     │ geometry        placement, reveal maths      │  src/shared/geometry
   every         │ platform logic  waiting, following, scroll-  │  src/shared/platform
   platform)     │                 ing into view, scroll end    │
                 │ overlay         what is shown, animation,    │  src/shared/renderer
                 │                 texts, what input means      │
                 │ provider core   props, engine, theme, texts  │  src/shared/react
                 └──────────────┬──────────────────┬───────────┘
                     PlatformAdapter         TourRenderer           ← the two ports (typed)
                 ┌──────────────┴──────┐  ┌────────┴────────────┐
  web            │ DOM measuring, scroll│  │ <dialog>, CSS, keys │  src/react-platform
  React Native   │ views, registry, hosts│  │ Animated, Pressable │  src/react-native-platform
                 └─────────────────────┘  └─────────────────────┘
```

- **Engine** (`src/shared/engine`): a framework-free store. Starts and ends tours, runs `onBeforeStep`, waits for targets, reveals them, computes the tooltip layout, calls `onTourEnd` exactly once. It talks to the platform only through `TourAdapter`, which `createTourAdapter` builds from the platform port.
- **Platform port** — [`PlatformAdapter`](src/shared/platform/platform.type.ts): raw facts only. How to measure a target, which events mean "something may have moved", which scroll containers surround a target and how a single scroll reports finishing, the visible area, the reduced-motion setting. Waiting for targets, following them, revealing them and deciding when scrolling has settled are shared ([`createTourAdapter`](src/shared/platform/create-tour-adapter.ts)).
- **Renderer port** — [`TourRenderer`](src/shared/renderer/renderer.type.ts): drawing primitives only (layer, backdrop, spotlight, tooltip frame, measuring frame, and the pieces of the built-in card). Every decision — visibility, timing, animation, texts, what a press or a key means — is made by the shared [`TourOverlay`](src/shared/renderer/tour-overlay.tsx) and [`DefaultTooltip`](src/shared/renderer/default-tooltip.tsx), with the timings in [`motion.ts`](src/shared/renderer/motion.ts).
- **Provider core** — [`useTourCore`](src/shared/react/tour-provider-core.ts): the props every `TourProvider` accepts and what they do. Each platform's `TourProvider` is a thin wrapper that creates its platform and mounts the overlay where that platform draws (a portal on the web, the active host on React Native).

## Where does my change go?

| The change is about…                                                | Put it in                                                            |
| ------------------------------------------------------------------- | -------------------------------------------------------------------- |
| What happens in a tour (steps, callbacks, skipping, ending)         | the engine                                                           |
| Where things are placed, how far to scroll                          | `src/shared/geometry` (pure functions, property-tested)              |
| When to wait, follow or consider scrolling finished                 | `src/shared/platform/create-tour-adapter.ts`                         |
| What is visible, how it animates, what a text says, what input does | `src/shared/renderer` (overlay, default tooltip, motion)             |
| A new `TourProvider` prop                                           | `TourProviderBaseProps` and `useTourCore`                            |
| A fact only a platform can know (a measurement, an event)           | a new member of `PlatformAdapter`, implemented by **every** platform |
| Something to draw that does not exist yet                           | a new primitive in `TourRenderer`, implemented by **every** platform |
| How a platform draws a primitive, or reads a fact                   | that platform's folder                                               |

If you are about to write an `if` in a platform folder, ask whether it is a decision. Decisions belong in the shared code; platforms translate them into pixels and events.

## Adding a feature: the checklist

1. Write the logic in the shared code.
2. If it needs a new platform fact or a new drawing primitive, add it to `PlatformAdapter` or `TourRenderer`. Both platforms now fail to compile until they implement it — that is the point.
3. Test the behaviour in the [shared behaviour suite](test/support/tour-behavior.suite.tsx). It runs against the web provider and the React Native provider (`tour-behavior.test.tsx` in `test/web` and `test/native`); a feature that works on only one of them fails there.
4. If the feature adds an export, add it to both [`src/react.ts`](src/react.ts) and [`src/react-native.ts`](src/react-native.ts). The [entry parity test](test/unit/entry-parity.test.ts) fails when one entry exports something the other does not, or when they export different implementations of a shared name. Platform-only exports must be declared there, with the reason.
5. Try it in both demos: `npm run demo:web`, `npm run demo:ios` / `npm run demo:android` (they run the source directly). If it changes how the tour looks, record the README's preview again from the showcase (`npm run demo:record`).

## What is platform-only, and why

Platform folders contain only what has no counterpart on the other platform:

- **Web**: CSS selectors as targets, the top-layer `<dialog>` (focus trap, inert page) in an element of its own whose events stay inside it, page scroll lock, keyboard navigation, elements that stay put while scrolling (sticky headers, banners), safe-area insets from `env()`, and the stylesheet with its CSS variables.
- **React Native**: registering targets and scroll views (`useTourTarget`, `useTourScrollView`) because views cannot be found by selector, `TourHost` because native modals are drawn above the app's root view, safe-area `insets` and the keyboard, the Android back button, and measuring views relative to the host layer.

Platform-only exports are listed in the entry parity test.

## What keeps the platforms in sync

| Guard                                                                   | Catches                                                                |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `PlatformAdapter` and `TourRenderer` types                              | a platform missing a fact or a primitive (compile error)               |
| `TourProviderBaseProps` + type assertions in the parity test            | a provider prop that exists on one platform only                       |
| [Entry parity test](test/unit/entry-parity.test.ts)                     | exports that differ, or a shared export re-implemented on one platform |
| [Shared behaviour suite](test/support/tour-behavior.suite.tsx)          | behaviour that works on one platform only                              |
| Lint rules (`xo.config.ts`)                                             | the web code importing React Native, or the other way round            |
| Playwright end-to-end tests (web) and Maestro flows (React Native demo) | behaviour on real browsers and devices                                 |

## Tests

All tests live in `test/`; the configuration files (`vitest.config.ts`, `playwright.config.ts`) are at the root.

| Folder           | What                                                                      | Run with             |
| ---------------- | ------------------------------------------------------------------------- | -------------------- |
| `test/unit`      | engine, geometry, platform logic, entry parity (Node), mirroring `src/`   | `npm run test:unit`  |
| `test/web`       | the web provider in a real browser                                        | `npm test`           |
| `test/native`    | the React Native provider, through react-native-web, in a real browser    | `npm test`           |
| `test/jsdom`     | a whole tour in jsdom, as apps' own test suites run it                    | `npm test`           |
| `test/support`   | the shared behaviour suite and helpers (fake adapter, browser setup)      |                      |
| `test/e2e`       | the web demo and the showcase on desktop and mobile browsers (Playwright) | `npm run test:e2e`   |
| `test/maestro`   | the React Native demo on simulators and devices (Maestro)                 | see the README       |
| `smoke-node.mjs` | the packed package, imported in plain Node with a server render           | `npm run smoke:node` |
