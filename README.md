# react-tour-kit

Guided tours for React and React Native that never leave the screen.

<p align="center">
  <a href="https://robertlinde.github.io/react-tour-kit/">
    <picture>
      <source media="(prefers-reduced-motion: reduce)" srcset="https://raw.githubusercontent.com/robertlinde/react-tour-kit/main/.github/assets/demo-poster.png" />
      <img src="https://raw.githubusercontent.com/robertlinde/react-tour-kit/main/.github/assets/demo.gif" width="100%" alt="An onboarding tour in a web app: it welcomes the user, highlights the search field and the New project button at the screen's edge, scrolls down to the activity feed, shows a spinner while the Team page loads, highlights Invite teammates there, and ends back on the Help button." />
    </picture>
  </a>
</p>

<p align="center"><a href="https://robertlinde.github.io/react-tour-kit/"><strong>Try the live demo →</strong></a></p>

Highlight any element, explain it in a tooltip, and walk users through your app — across pages and screens, into scroll containers and modals. The tour takes care of everything around it: it waits for targets to appear, scrolls them into view (clear of sticky headers and floating buttons), keeps the tooltip on screen on every device, animates smoothly, and is accessible out of the box.

```tsx
const {startTour} = useTour();

startTour([
  {target: '[data-tour="search"]', title: 'Search', content: 'Find anything in your workspace.'},
  {target: '[data-tour="new"]', title: 'Create', content: 'Start a new project here.'},
]);
```

- **Simple**: one provider, one hook. Steps are plain objects.
- **Always in sight**: the target is scrolled into view — through nested scroll containers, horizontal lists, and past sticky headers, cookie banners and floating buttons — and the tooltip stays inside the visible screen and its safe areas, at any size, orientation and zoom.
- **Across pages and screens**: a step's `onBeforeStep` navigates; the tour waits for the target by itself.
- **Smooth**: the highlight glides from step to step, with the scroll. Nothing runs once a step is in place.
- **Accessible**: a real modal dialog with focus management, keyboard navigation and screen-reader announcements on the web; screen-reader focus, roles and the back button on React Native.
- **Themeable and customisable**: colours, texts, a content-only custom tooltip, and CSS hooks on the web.
- **Small and typed**: no dependencies besides React (and React Native), written in TypeScript.

## Contents

- [Installation](#installation)
- [API at a glance](#api-at-a-glance)
- [Web](#web)
- [React Native](#react-native)
- [Steps](#steps)
- [Tours across pages and screens](#tours-across-pages-and-screens)
- [`useTour()`](#usetour)
- [When a tour ends](#when-a-tour-ends)
- [Theme](#theme)
- [Texts and languages](#texts-and-languages)
- [Custom tooltip](#custom-tooltip)
- [Styling with CSS (web)](#styling-with-css-web)
- [What the tour does for you](#what-the-tour-does-for-you)
- [Testing your app](#testing-your-app)
- [Requirements](#requirements)
- [Migrating from 0.x](#migrating-from-0x)
- [Development](#development)

## Installation

```bash
npm install @robertlinde/react-tour-kit
```

There is nothing else to install: no `react-native-svg`, no stylesheet to import.

| Platform     | Import from                                | Targets                                         |
| ------------ | ------------------------------------------ | ----------------------------------------------- |
| Web          | `@robertlinde/react-tour-kit/react`        | CSS selectors such as `'[data-tour="welcome"]'` |
| React Native | `@robertlinde/react-tour-kit/react-native` | ids registered with `useTourTarget`             |

## API at a glance

Everything you pass to the tour, with links to the details.

**`<TourProvider>`**: all props are optional.

| Prop                    | Type                                                | Default       | Details                                     |
| ----------------------- | --------------------------------------------------- | ------------- | ------------------------------------------- |
| `theme`                 | `TourTheme`: colours                                | blue on white | [Theme](#theme)                             |
| `i18n`                  | `TourI18n`: texts                                   | English       | [Texts and languages](#texts-and-languages) |
| `onTourEnd`             | `(tourId, info) => void`                            | –             | [When a tour ends](#when-a-tour-ends)       |
| `closeOnOverlayClick`   | `boolean`: a press on the dimmed area ends the tour | `true`        | [When a tour ends](#when-a-tour-ends)       |
| `TooltipComponent`      | `ComponentType<TourTooltipProps>`                   | built-in      | [Custom tooltip](#custom-tooltip)           |
| `insets` (React Native) | `{top, right, bottom, left}`                        | safe defaults | [React Native](#react-native)               |

**`startTour(steps, tourId?, options?)`**, from [`useTour()`](#usetour):

| Argument            | Type                     | Details                                                                     |
| ------------------- | ------------------------ | --------------------------------------------------------------------------- |
| `steps`             | `TourStep[]`             | below                                                                       |
| `tourId`            | `string`                 | names the tour in `onTourEnd`; starting the running tour again does nothing |
| `options.onTourEnd` | `(tourId, info) => void` | for this tour only, before the provider's                                   |

**`TourStep`**, see [Steps](#steps):

| Field          | Type                                                                           | Default            |
| -------------- | ------------------------------------------------------------------------------ | ------------------ |
| `target`       | web: CSS selector or element ref; React Native: `useTourTarget` id or view ref | none: centred step |
| `title`        | `ReactNode`                                                                    | required           |
| `content`      | `ReactNode`                                                                    | required           |
| `placement`    | `'top' \| 'bottom' \| 'left' \| 'right'`                                       | `'bottom'`         |
| `onBeforeStep` | `(target, {signal}) => void \| Promise<void>`                                  | –                  |

**React Native only**: `useTourTarget(id)` registers a view as a target, `useTourScrollView(ref?)` lets the tour scroll a list, and `<TourHost />` draws the tour in modal screens. See [React Native](#react-native).

## Web

**1. Wrap your app in `TourProvider`** — inside your router if steps navigate between pages.

```tsx
import {TourProvider} from '@robertlinde/react-tour-kit/react';

export function App() {
  return (
    <BrowserRouter>
      <TourProvider>
        <Routes>{/* … */}</Routes>
      </TourProvider>
    </BrowserRouter>
  );
}
```

**2. Mark the elements** you want to highlight. Any CSS selector works; data attributes keep the tour independent of your styling.

```tsx
<nav data-tour="sidebar">…</nav>
<button data-tour="settings">Settings</button>
```

**3. Start a tour** from anywhere inside the provider.

```tsx
import {type TourStep, useTour} from '@robertlinde/react-tour-kit/react';

const onboarding: TourStep[] = [
  {
    title: 'Welcome!',
    content: 'Let me show you around.', // no target: shown in the centre of the screen
  },
  {
    target: '[data-tour="sidebar"]',
    title: 'Navigation',
    content: 'Everything you need is one click away.',
    placement: 'right',
  },
  {
    target: '[data-tour="settings"]',
    title: 'Settings',
    content: 'Make it yours.',
  },
];

function StartButton() {
  const {startTour} = useTour();
  return <button onClick={() => startTour(onboarding, 'onboarding')}>Take the tour</button>;
}
```

While a tour is open, the page cannot be scrolled away from it with the wheel, touch or keyboard (a classic, always-visible scrollbar stays usable, as browsers do not let pages block it; the tour then keeps the target in view), and the tour is announced as a modal dialog. Keyboard: <kbd>→</kbd> next, <kbd>←</kbd> back (swapped in right-to-left pages), <kbd>Esc</kbd> closes. Presses, focus and keys inside the tour do not reach your page's own listeners, so a menu that closes on "click outside" stays open while a step points at it. Tours also work inside your app's own modal dialogs (Radix and shadcn/ui, for example): the dialog stays open, <kbd>Esc</kbd> closes the tour first, and screen readers can reach the tour. Opening the tour (a modal dialog) does close elements shown with `popover="auto"`: for a popover a step points at, use `popover="manual"`.

### Next.js

The web entry is marked `'use client'`, so `TourProvider` can be rendered directly in a server component such as the root layout. It renders nothing extra on the server.

```tsx
// app/layout.tsx
import {TourProvider} from '@robertlinde/react-tour-kit/react';

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body>
        <TourProvider>{children}</TourProvider>
      </body>
    </html>
  );
}
```

Components that call `useTour()` must be client components (`'use client'`).

## React Native

**1. Wrap your app in `TourProvider`** at the root, around your navigation container. It has to fill the window, so place it **outside** any `SafeAreaView` or padded container and pass the safe-area insets instead:

```tsx
import {NavigationContainer} from '@react-navigation/native';
import {SafeAreaProvider, useSafeAreaInsets} from 'react-native-safe-area-context';
import {TourProvider} from '@robertlinde/react-tour-kit/react-native';

function Root() {
  const insets = useSafeAreaInsets();
  return (
    <TourProvider insets={insets}>
      <NavigationContainer>{/* … */}</NavigationContainer>
    </TourProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Root />
    </SafeAreaProvider>
  );
}
```

Without `insets`, conservative defaults keep the tooltip clear of the notch, Dynamic Island, status bar and home indicator.

**2. Register the views** you want to highlight with `useTourTarget`, and use the id as the step's `target`:

```tsx
import {Pressable, Text} from 'react-native';
import {useTourTarget} from '@robertlinde/react-tour-kit/react-native';

function SettingsButton() {
  const ref = useTourTarget('settings');
  return (
    <Pressable ref={ref} onPress={openSettings}>
      <Text>Settings</Text>
    </Pressable>
  );
}
```

The ref is typed for `View` and components that forward their ref to one, such as `Pressable`. For other components, pass a type argument: `useTourTarget<MyComponentRef>('id')`. On the Old Architecture, Android leaves out views that only lay out their children; if a plain `View` target is never found there, give it `collapsable={false}`.

**3. Let the tour scroll your lists.** For targets that can be off screen, register the scroll views around them with `useTourScrollView` — it works with `ScrollView`, `FlatList`, `SectionList` and their animated versions, vertical and horizontal, nested too:

```tsx
import {FlatList, ScrollView} from 'react-native';
import {useTourScrollView} from '@robertlinde/react-tour-kit/react-native';

function Home() {
  const scrollRef = useTourScrollView();
  return <ScrollView ref={scrollRef}>…</ScrollView>;
}

function Carousel() {
  const listRef = useTourScrollView<FlatList<Item>>();
  return <FlatList ref={listRef} horizontal data={items} renderItem={renderItem} />;
}
```

If the list already has a ref, pass it in: `useTourScrollView(existingRef)`. Items of a virtualised list that are not rendered yet cannot be found; scroll to them in the step's `onBeforeStep` (for example with `scrollToIndex`).

**4. Start a tour** exactly as on the web:

```tsx
import {type TourStep, useTour} from '@robertlinde/react-tour-kit/react-native';

const steps: TourStep[] = [
  {target: 'profile', title: 'Your profile', content: 'Tap here to edit it.'},
  {target: 'settings', title: 'Settings', content: 'Make it yours.', placement: 'top'},
];

const {startTour} = useTour();
startTour(steps, 'onboarding');
```

The Android back button closes the tour. Screen readers move to the tooltip and announce each step.

### Modal screens

The tour is drawn inside your app's root view. Screens presented as native modals (react-navigation's `presentation: 'modal'`, or a React Native `<Modal>`) are drawn above that view, so to highlight something in them, add a `<TourHost />` as the last child of the modal screen:

```tsx
import {TourHost} from '@robertlinde/react-tour-kit/react-native';

function HelpScreen() {
  return (
    <View style={{flex: 1}}>
      {/* … */}
      <TourHost />
    </View>
  );
}
```

While the screen is open, the tour is drawn there; when it closes, the tour returns to the root. VoiceOver then ignores the rest of the modal screen while a step is shown (TalkBack can still reach it).

Inside a React Native `<Modal>`, the Android back button goes to the modal's `onRequestClose`, not to the tour. End the tour there first:

```tsx
const {isActive, endTour} = useTour();

<Modal visible={isOpen} onRequestClose={() => (isActive ? endTour() : setIsOpen(false))}>
  {/* … */}
  <TourHost />
</Modal>;
```

### Android navigation bar

The tour draws in your app's own window, so the system navigation bar looks exactly as it does in your app. Since Android 15 apps draw edge to edge, and with 3-button navigation Android puts a translucent contrast scrim behind the buttons. To keep the bar transparent (so the tour's dimmed overlay shows behind the buttons), turn the scrim off:

- **Expo**: add the [`expo-navigation-bar`](https://docs.expo.dev/versions/latest/sdk/navigation-bar/) config plugin to your app config, then rebuild the native app:

  ```json
  {
    "expo": {
      "plugins": [["expo-navigation-bar", {"enforceContrast": false}]]
    }
  }
  ```

- **Bare React Native**: in `MainActivity`, after `super.onCreate(…)`:

  ```kotlin
  if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
    window.isNavigationBarContrastEnforced = false
  }
  ```

(0.x drew the tour in a React Native `<Modal>`, which opens its own window. Under edge to edge, React Native forces the contrast scrim on in that window, which showed as a white strip. 1.0 no longer uses a modal.)

## Steps

```ts
type TourStep = {
  target?: TourTarget; // what to highlight; leave it out for a step in the centre of the screen
  title: ReactNode;
  content: ReactNode;
  placement?: 'top' | 'bottom' | 'left' | 'right'; // preferred side, default 'bottom'
  onBeforeStep?: (target, {signal}) => void | Promise<void>;
};
```

- **`target`**: on the web a CSS selector (the first _visible_ match is used) or a ref to an element; on React Native an id registered with `useTourTarget`, or a ref to a view.
- **`title` and `content`** can be any React content (text, links, images).
- **`placement`** is a preference. If there is not enough room on that side, the tooltip moves to the opposite side, then to the roomier of the remaining sides; it is never pushed off screen.
- **`onBeforeStep`** runs before the step is shown — to navigate, open a menu, switch a tab, or load data. The tour waits for its promise, then for the target to appear (up to 5 seconds), so there is no need to poll or add delays. It receives the step's target and an `AbortSignal` that aborts when the step is abandoned (the user moves on or closes the tour). Make it idempotent: it runs again when the user comes back to the step. If it throws or rejects, the tour ends with the reason `'error'`.

**Missing targets**: if a step's target does not appear within 5 seconds, or cannot be scrolled into view (and has not moved for a second, in case an animation is still bringing it in), the step is skipped (with a warning in development) and the tour continues in the direction the user was going. Going back past the first step returns to the step the user came from. If no step can be shown at all, the tour ends with `'target-missing'`.

**Carousels and sliders**: the tour scrolls everything users can scroll, but never an element with `overflow: hidden` — what such an element shows is up to your app (carousels, sliders, off-canvas menus), and scrolling it would leave it out of step with your app's state. Bring the target into view in `onBeforeStep`, for example by moving the carousel to its slide.

## Tours across pages and screens

Put `TourProvider` around your router or navigator, and let each step open its page in `onBeforeStep`. Making every step open its own page keeps going back working too.

### Web (React Router)

```tsx
import {useNavigate} from 'react-router-dom';
import {type TourStep, useTour} from '@robertlinde/react-tour-kit/react';

function useOnboarding() {
  const navigate = useNavigate();
  const {startTour} = useTour();

  // Opens a page unless it is already open (no duplicate history entries).
  const on = (path: string, step: TourStep): TourStep => ({
    ...step,
    onBeforeStep() {
      if (location.pathname !== path) {
        navigate(path);
      }
    },
  });

  return () =>
    startTour(
      [
        on('/', {target: '[data-tour="projects"]', title: 'Projects', content: 'All your work.'}),
        on('/settings', {target: '[data-tour="theme"]', title: 'Theme', content: 'Light or dark?'}),
        on('/', {target: '[data-tour="help"]', title: 'Help', content: 'We are here for you.'}),
      ],
      'onboarding',
    );
}
```

### React Native (React Navigation)

```tsx
import {CommonActions, createNavigationContainerRef, StackActions} from '@react-navigation/native';

export const navigation = createNavigationContainerRef<Screens>(); // <NavigationContainer ref={navigation}>

/** Shows a screen: goes back to it when it is already open, otherwise opens it. */
function show(screen: keyof Screens) {
  if (!navigation.isReady() || navigation.getCurrentRoute()?.name === screen) {
    return;
  }

  const isOpen = navigation.getRootState()?.routes.some((route) => route.name === screen) ?? false;
  navigation.dispatch(isOpen ? StackActions.popTo(screen) : CommonActions.navigate(screen));
}

const on = (screen: keyof Screens, step: TourStep): TourStep => ({
  ...step,
  onBeforeStep() {
    show(screen);
  },
});

const steps = [
  on('Home', {target: 'projects', title: 'Projects', content: 'All your work.'}),
  on('Settings', {target: 'theme', title: 'Theme', content: 'Light or dark?'}),
];
```

The [demos](#development) contain complete, working examples of both.

## `useTour()`

```ts
const {
  isActive, // boolean: a tour is running
  currentStep, // number: index of the step on screen
  steps, // readonly TourStep[]: the steps of the running tour
  currentTourId, // string | undefined
  startTour, // (steps, tourId?, options?) => void
  endTour, // () => void — ends with the reason 'closed'
  nextStep, // () => void — completes the tour on the last step
  prevStep, // () => void
  goToStep, // (index: number) => void
} = useTour();
```

The functions never change identity, so they are safe in effect dependencies. Starting the tour that is already running (same `tourId`, or the same steps array without an id) does nothing, which makes "start on mount" effects safe in Strict Mode. Starting a different tour ends the current one with `'closed'`.

```tsx
// Show the onboarding once.
useEffect(() => {
  if (!user.hasSeenOnboarding) {
    startTour(onboarding, 'onboarding');
  }
}, [user.hasSeenOnboarding, startTour]);
```

## When a tour ends

Pass `onTourEnd` to the provider (for every tour, for example analytics) and/or to `startTour` (for one tour). Both run exactly once per tour: the tour's own callback first, then the provider's.

```tsx
<TourProvider
  onTourEnd={(tourId, info) => {
    analytics.track('tour_ended', {tourId, reason: info.reason, step: info.stepIndex + 1, of: info.totalSteps});
  }}
>
```

```tsx
startTour(onboarding, 'onboarding', {
  onTourEnd(tourId, info) {
    if (info.reason === 'completed') {
      markOnboardingDone();
    }
  },
});
```

| `info.reason`      | When                                                                                |
| ------------------ | ----------------------------------------------------------------------------------- |
| `'completed'`      | Finish on the last step                                                             |
| `'closed'`         | The close button, `endTour()`, the Android back button, or another tour was started |
| `'blur'`           | A click or tap on the dimmed area (only with `closeOnOverlayClick`, the default)    |
| `'escape'`         | <kbd>Esc</kbd> on the web, the VoiceOver escape gesture on iOS                      |
| `'target-missing'` | No remaining step could be shown                                                    |
| `'error'`          | A step's `onBeforeStep` threw or rejected; the error is in `info.error`             |

`info` also has `stepIndex`, `step` and `totalSteps`. If a callback throws, the error is reported (`reportError` in browsers, `console.error` on React Native) and the tour still closes.

Set `closeOnOverlayClick={false}` on the provider to close only with the close button, <kbd>Esc</kbd> and the back button.

## Theme

```tsx
<TourProvider
  theme={{
    primaryColor: '#8b5cf6',
    tooltipBackground: '#1f2937',
    titleColor: '#f9fafb',
    contentColor: '#d1d5db',
    overlayColor: 'rgba(0, 0, 0, 0.7)',
  }}
>
```

| Key                 | Used for                                                    | Default                |
| ------------------- | ----------------------------------------------------------- | ---------------------- |
| `primaryColor`      | Buttons, step badge, active dot, highlight ring             | `'#2563eb'`            |
| `primaryTextColor`  | Text on `primaryColor`                                      | `'#ffffff'`            |
| `tooltipBackground` | The tooltip                                                 | `'#ffffff'`            |
| `titleColor`        | The title                                                   | `'#111827'`            |
| `contentColor`      | The content; muted parts (dots, Back button) derive from it | `'#4b5563'`            |
| `overlayColor`      | The dimmed area (include transparency)                      | `'rgba(0, 0, 0, 0.5)'` |

The defaults meet WCAG AA contrast. A dark theme only needs a dark background and light text colours.

## Texts and languages

```tsx
<TourProvider
  i18n={{
    nextLabel: 'Weiter',
    prevLabel: 'Zurück',
    finishLabel: 'Fertig',
    stepCounterTemplate: '{current} von {total}',
    closeAriaLabel: 'Tour schließen',
    dotAriaLabelTemplate: 'Zu Schritt {step}',
    loadingAriaLabel: 'Wird geladen…',
  }}
>
```

| Key                    | Default                  |
| ---------------------- | ------------------------ |
| `nextLabel`            | `'Next'`                 |
| `prevLabel`            | `'Back'`                 |
| `finishLabel`          | `'Finish'`               |
| `stepCounterTemplate`  | `'{current} of {total}'` |
| `closeAriaLabel`       | `'Close tour'`           |
| `dotAriaLabelTemplate` | `'Go to step {step}'`    |
| `loadingAriaLabel`     | `'Loading…'`             |

## Custom tooltip

`TooltipComponent` replaces what is _inside_ the tooltip. The tour still measures it, places it, keeps it on screen, animates it, and moves focus to it — your component only renders content and calls the callbacks:

```tsx
import {type TourTooltipProps} from '@robertlinde/react-tour-kit/react';

function MyTooltip({step, currentStep, totalSteps, onNext, onPrev, onClose, titleId, descriptionId}: TourTooltipProps) {
  const isLast = currentStep === totalSteps - 1;
  return (
    <div className="my-tooltip">
      <h3 id={titleId}>{step.title}</h3>
      <div id={descriptionId}>{step.content}</div>
      <footer>
        <button onClick={onClose}>Skip</button>
        <span>
          {currentStep + 1}/{totalSteps}
        </span>
        <button disabled={currentStep === 0} onClick={onPrev}>
          Back
        </button>
        <button onClick={onNext}>{isLast ? 'Done' : 'Next'}</button>
      </footer>
    </div>
  );
}

<TourProvider TooltipComponent={MyTooltip}>…</TourProvider>;
```

On React Native, render views instead; everything else is the same.

| Prop                             | Description                                                                                                          |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `step`                           | The step being shown                                                                                                 |
| `currentStep`, `totalSteps`      | Zero-based index and count                                                                                           |
| `onNext`, `onPrev`, `onClose`    | Navigation; `onNext` completes the tour on the last step                                                             |
| `onGoToStep(index)`              | Jump to a step (for clickable dots)                                                                                  |
| `placement`                      | The side the tooltip ended up on, or `'center'`                                                                      |
| `arrowOffset`                    | Where an arrow should point, in pixels from the tooltip's left (top/bottom) or top (left/right) edge; or `undefined` |
| `titleId`, `descriptionId` (web) | Put them on the title and content elements so screen readers announce them                                           |

The card around your content has the theme's background, rounded corners and a shadow; style the inside as you like. `getTruncatedDots(current, total)` is exported for building a compact dot pager like the built-in one.

## Styling with CSS (web)

The built-in tooltip and overlay use stable class names and CSS variables, so you can restyle them without a custom component. All built-in rules live in a CSS cascade layer, so your own CSS wins over them — whatever its specificity, without `!important`. (If your CSS is itself inside a layer, such as Tailwind's, write these overrides outside of it.)

The exceptions are the few properties that keep the tour in place, clickable and readable, which global styles would otherwise change (Tailwind's preflight, normalize.css, Bootstrap, or rules for every `dialog` or `button`): the position, size and spacing of the dialog, the highlight and the tooltip box, and the box, spacing, colours and font size of the buttons. They are `!important` in the built-in styles; their colours still come from the variables below. To change one of them anyway, use `!important` in your rule.

```css
.rtk-root {
  --rtk-radius: 4px; /* tooltip corners */
  --rtk-spotlight-radius: 2px; /* highlight corners */
  --rtk-z-index: 10000; /* only used where the browser has no top layer */
}

.rtk-title {
  font-family: 'Inter', sans-serif;
}
```

- **Variables**: `--rtk-radius`, `--rtk-spotlight-radius`, `--rtk-ease`, `--rtk-z-index`. The colours `--rtk-primary`, `--rtk-on-primary`, `--rtk-bg`, `--rtk-title`, `--rtk-text` and `--rtk-overlay` come from the `theme` prop (set on `.rtk-root` directly): change them with `theme`, or override them on an element inside the tour, such as `.rtk-card`.
- **Classes**: `.rtk-root` (the dialog), `.rtk-backdrop`, `.rtk-spotlight` (the highlight), `.rtk-tooltip` (positioned box), `.rtk-card` (the tooltip itself), `.rtk-header`, `.rtk-counter`, `.rtk-close`, `.rtk-body`, `.rtk-title`, `.rtk-content`, `.rtk-footer`, `.rtk-button`, `.rtk-button--prev`, `.rtk-button--next`, `.rtk-dots`, `.rtk-dot`, `.rtk-arrow`.
- **State**: `.rtk-tooltip[data-placement="top|bottom|left|right|center"]`, `.rtk-root[data-state="closing"]`.

The tour is rendered as a modal `<dialog>` in the browser's top layer, so it is always above your app, whatever its `z-index` values and stacking contexts.

## What the tour does for you

- **Keeps everything in sight.** Before a step is shown, its target is scrolled into view — through every scroll container around it, including horizontal ones — with room for the tooltip. Elements that stay put while the page scrolls (sticky headers, cookie banners, floating buttons; any number, any shape) are detected and the target is scrolled clear of them, in both directions. Targets larger than the screen are aligned to their start. The tooltip is placed inside the visible screen minus safe areas and the on-screen keyboard, flips to another side when there is no room, and scrolls its own content if it is taller than the screen. When the window is resized or rotated, or your app or an animation moves the target, the tour follows.
- **Waits instead of guessing.** Targets that are not rendered yet (lazy pages, animations, data loading) are awaited, event-driven, for up to 5 seconds. When a step takes a moment to prepare (more than 300 ms), the tour shows that it is waiting: the highlight closes, the screen is dimmed and a spinner appears in the middle (announced to screen readers as `loadingAriaLabel`). If the previous step's target goes away meanwhile (`onBeforeStep` navigated to another page, for example), that step does not stay over the new page: it goes at once. Pressing the dimmed area meanwhile leaves the tour.
- **Animates.** The tour fades in, the highlight glides from target to target together with the scroll, and the tooltip enters from the side it is on. On React Native every animation runs on the UI thread, so it stays smooth while JavaScript is busy. With reduced motion turned on in the system, movement is replaced by short fades.
- **Is accessible.** On the web the tour is a modal dialog (`aria-modal`, labelled by the step title, described by its content): focus moves into the tooltip and back to where it was when the tour ends, the rest of the page is inert, arrow keys work (but leave text fields, sliders, radio groups and other controls in a custom tooltip alone), <kbd>Esc</kbd> closes the tour, a long tooltip scrolls with the keyboard, and step changes are announced. Buttons have accessible names and large enough touch targets. In Windows high-contrast mode the highlight is drawn as an outline. On React Native, screen-reader focus moves to the tooltip, the app behind it is hidden from screen readers (in a `TourHost`, see [Modal screens](#modal-screens)), and the back button closes the tour.
- **Costs nothing while idle.** Right after a step appears, the tour checks its target every frame until it has stayed put for a second (three at most), because animations can move it without any event (a React Native screen sliding in, for example). After that, while nothing moves, the tour does no work at all: no timers, no measuring, no re-rendering. Scrolling and resizing are followed once per frame, without re-rendering your app. `useTour()` only re-renders components when the tour's state changes.
- **Is safe.** Callbacks run exactly once, also in Strict Mode, with double clicks and when tours replace each other. Errors in your callbacks are reported and never leave the tour stuck.

## Testing your app

- **jsdom (Jest, Vitest)**: tours run in jsdom, with or without a `ResizeObserver` polyfill. jsdom has no layout, so every target counts as visible at the top of the screen; test that your steps and callbacks work, and leave the visual part to end-to-end tests.
- **Jest**: the package is ESM-only, and Jest runs CommonJS by default, so Jest has to transform it. Exempt it from `transformIgnorePatterns`: on the web, for example `'/node_modules/(?!@robertlinde/react-tour-kit/)'` (with a Babel or SWC transform that turns ES modules into CommonJS, which `babel-jest` with `@babel/preset-env` does); with React Native's preset, `'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@robertlinde/react-tour-kit)/)'`; with Next.js's `next/jest`, add the package to `transpilePackages` in `next.config`. Vitest needs nothing.
- **End-to-end (web)**: the tooltip is a `dialog` named after the step title, so `page.getByRole('dialog', {name: 'Settings'})` finds it. The buttons are named by your `i18n` labels.
- **End-to-end (React Native)**: the built-in tooltip has the testIDs `rtk-tooltip`, `rtk-next`, `rtk-prev` and `rtk-close`. Prefer them over texts: on Android, "Back" and "Home" also match the system navigation bar. While a tour is open, the app behind it is hidden from accessibility (except while a `TourHost` draws it), so UI-test tools mostly see only the tour.

## Requirements

- React 18 or 19.
- Web: current versions of Chrome, Edge, Firefox and Safari.
- React Native 0.79 or newer (Expo SDK 53 or newer).
- ESM-only: works with every bundler (Vite, webpack, Next.js, Metro, …) and with Node's `import`.
- TypeScript: `moduleResolution` `bundler`, `node16` or `nodenext` (the defaults of current React Native, Expo, Next.js and Vite projects).

## Migrating from 0.x

1.0 is a rewrite with a smaller, safer API. Most apps only need to change a custom tooltip, if they have one. See [MIGRATION.md](./MIGRATION.md) for every change with before-and-after examples, and [CHANGELOG.md](./CHANGELOG.md) for what is new.

## Development

```bash
npm install
npm test            # unit and component tests (Vitest, real browser)
npm run test:e2e    # end-to-end tests on desktop and mobile browsers (Playwright)
npm run lint
npm run typecheck
npm run build
```

How the code is organised, and how to add a feature so that both platforms get it, is described in [ARCHITECTURE.md](./ARCHITECTURE.md).

The demos use the library's source directly, so every change is live there:

```bash
npm run demo:web       # web demo: http://localhost:5173 — includes a /lab page with edge cases
npm run demo:showcase  # the showcase: the live demo on GitHub Pages, deployed from main
npm run demo:ios       # React Native demo in Expo Go (run `npm install` in demos/react-native first)
npm run demo:android
```

The animated preview at the top of this README is recorded from the showcase: `npm run demo:record` writes `.github/assets/demo.gif` and its still poster (it needs ffmpeg and gifski: `brew install ffmpeg gifski`). Record it again when the showcase or the look of the tour changes.

All tests are in `test/` (see [ARCHITECTURE.md](./ARCHITECTURE.md#tests)). The React Native demo is tested with [Maestro](https://maestro.dev) flows: with the app open, run `maestro test test/maestro -e APP_ID=host.exp.Exponent`. To see the Android navigation bar setting in effect, build the app natively with `npx expo run:android`.

## License

MIT
