# Changelog

Releases are published automatically from `main`; each GitHub release lists its commits. This file describes the larger changes.

## 1.1.0

### Added

- A waiting state: when a step takes a moment to prepare (`onBeforeStep` loading data or navigating, a target that is still rendering), the highlight closes, the screen is dimmed and a spinner appears in the middle, on the web and React Native, with built-in and custom tooltips alike. Before, the previous step stayed unchanged and Next seemed to do nothing until the next one appeared. Pressing the dimmed area meanwhile leaves the tour.
- `i18n.loadingAriaLabel` (default `'Loading…'`): what screen readers announce while the tour waits, and the spinner's accessible name.

## 1.0.3

### Fixed

Tours started inside an app's own modal dialog (Radix and shadcn/ui, for example):

- Screen readers could not reach the tour: the dialog library hid it along with the rest of the page (`aria-hidden`). Libraries that make the rest of the page `inert` blocked it entirely.
- <kbd>Esc</kbd> closed the app's dialog underneath instead of the tour. While a tour is open, <kbd>Esc</kbd> now always closes the tour, also when a control in a custom tooltip has focus.
- A long tooltip did not scroll with the mouse wheel or touch.

## 1.0.2

### Fixed

- When a target moved on its own while the highlight was still gliding to it (right after its step appeared, for example when a screen finishes sliding in), the tooltip jumped to the new place at once but the highlight only caught up a moment later. Both now move together. On React Native, the highlight also always ends up at the latest position when it is moved while an animation is still running.

## 1.0.1

### Fixed

- Targets moved by animations that report no events are followed: a React Native screen sliding in with the native driver (a stack navigator, for example), or an animation of the Web Animations API. Until such an animation ends, the target is measured where it started:
  - when that was on screen, the highlight and tooltip stayed there instead of following the target;
  - when it was off screen (a screen sliding in from the side), the step was skipped.

## 1.0.0

A rewrite for reliability, smoothness and accessibility. The everyday API is unchanged; see [MIGRATION.md](./MIGRATION.md) for the breaking changes.

### Breaking

- Custom tooltips (`TooltipComponent`) only render content; the tour measures, positions, animates and focuses them. `position`, `isPositioned`, `onMeasured`, `theme` and `i18n` props and `forwardRef` are gone; `step`, `placement`, `arrowOffset`, `titleId` and `descriptionId` are new.
- `OverlayComponent` and the `platform` prop are removed, as are the internal exports (`TourContext`, `TourOverlay`, `TourTooltip`, `calculateTooltipPosition`, `findVisibleElement`, the platform adapters, the target registry, the `DOT_*` constants and the `Rect` and `TourOverlayProps` types).
- React Native: the tour is drawn in the app's root view instead of a `<Modal>`. `TourProvider` must wrap the app root, outside `SafeAreaView`. `react-native-svg` is no longer used. React Native 0.79 or newer is required.
- `TourEndReason` has a new member, `'error'`.
- Step types are wider: `title` and `content` are `ReactNode`, `target` is optional, and `onBeforeStep` receives `TourTarget | undefined` and a `{signal}`.
- Default primary colour `#2563eb` and title colour `#111827` (WCAG AA contrast); the same default texts on both platforms (`'Finish'`, `'{current} of {total}'`).
- ESM-only package.

### Added

- **Never out of sight**: targets are scrolled into view through every scroll container (vertical and horizontal), clear of sticky headers, banners and floating buttons; the tooltip always stays inside the visible screen and its safe areas, on every screen size, orientation and zoom level, and flips sides when there is no room.
- Targets are awaited (up to 5 seconds) after `onBeforeStep`: no more polling or delays.
- Smooth animations: the highlight glides between steps together with the scroll, the tooltip enters from its side, and the tour fades in and out. Reduced motion is respected.
- Steps without a `target` are shown in the centre. `title` and `content` accept any React content. On the web, `target` can be a ref.
- `onBeforeStep` receives an `AbortSignal` that is aborted when the step is abandoned. Errors end the tour with `'error'` and `info.error`.
- Web: the tour is a modal `<dialog>` in the browser's top layer — above every `z-index` and stacking context — with focus management, screen-reader announcements and right-to-left support. Page scrolling is blocked while a tour is open. Presses, focus and keys inside the tour do not reach the page's own listeners (menus that close on "click outside" stay open). Global styles such as Tailwind's preflight cannot break it. Stable `rtk-*` classes and CSS variables for styling, in a cascade layer that app CSS overrides. Elements with `overflow: hidden` (carousels) are never scrolled by the tour.
- React Native: `useTourScrollView()` lets the tour scroll `ScrollView`, `FlatList` and `SectionList`; `<TourHost />` shows tours in native modal screens; an `insets` prop for safe areas (with conservative defaults); the on-screen keyboard is avoided; the Android back button closes the tour; screen-reader focus moves to the tooltip and step changes are announced; stable `testID`s for UI tests.
- Server rendering and Next.js App Router support (`'use client'`).

### Fixed

- No work while idle: 0.x re-rendered, re-measured and called `scrollTo` about 19 times a second while a step was open, pulling the page back when the user scrolled.
- `onBeforeStep` runs exactly once per step; it used to run again whenever the app re-rendered with a new `onTourEnd` function.
- React 18 works (0.x used React 19-only APIs).
- The package loads in Node (0.x failed with `ERR_UNSUPPORTED_DIR_IMPORT`).
- Android: no white strip over the navigation bar under edge to edge (caused by the `<Modal>` window).
- The highlight lines up exactly on React Native, including with translucent status bars.
- Double clicks no longer skip steps; arrow keys no longer act while typing in a text field; clicks inside the highlight no longer close the tour; going back no longer skips forward over missing targets.
- `onTourEnd` fires exactly once per tour, also when a tour is replaced by another one.
- Accessibility: dialog semantics, labelled buttons, keyboard support, AA contrast and Windows high-contrast mode (0.x had none of these).
