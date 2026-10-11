# Migrating from 0.x to 1.0

1.0 is a rewrite. The everyday API — `TourProvider`, `useTour()`, `startTour(steps, id, {onTourEnd})`, the step fields, `theme`, `i18n`, `onTourEnd`, `closeOnOverlayClick` and `useTourTarget` — is unchanged. What changed is mostly what you no longer have to do yourself.

## Checklist

- [ ] **Custom tooltip?** Make it content-only: no `forwardRef`, no `position`, no `isPositioned`. → [details](#custom-tooltips-are-content-only)
- [ ] **Custom overlay?** Remove `OverlayComponent`; use `theme.overlayColor` or CSS. → [details](#overlaycomponent-and-platform-are-removed)
- [ ] **Polling or delays in `onBeforeStep`?** Delete them. → [details](#onbeforestep-no-polling-no-delays)
- [ ] **React Native:** move `TourProvider` to the root, outside `SafeAreaView`, pass `insets`, remove `react-native-svg` if nothing else uses it. → [details](#react-native)
- [ ] **Exhaustive `switch` on `info.reason`?** Add `'error'`. → [details](#a-new-end-reason-error)
- [ ] **Imports of internals** (`webPlatformAdapter`, `calculateTooltipPosition`, `TourContext`, …)? Remove them. → [details](#removed-exports)
- [ ] **TypeScript code that reads steps** (`step.title` as a `string`, `onBeforeStep(target: TourTarget)`)? See [step types](#step-types).
- [ ] **Snapshot or end-to-end tests** that check labels or colours? Check the [new defaults](#changed-defaults).

## Custom tooltips are content-only

In 0.x a custom tooltip had to position itself, forward a ref so it could be measured, and hide itself until it was positioned. In 1.0 the tour does all of that — measuring, placing, flipping, keeping it on screen, animating, focusing — and your component only renders the content.

**Before**

```tsx
const MyTooltip = forwardRef<HTMLDivElement, TourTooltipProps>(
  ({title, content, currentStep, totalSteps, position, isPositioned, onNext, onPrev, onClose}, ref) => (
    <div
      ref={ref}
      className="my-tooltip"
      style={{position: 'fixed', top: position.top, left: position.left, opacity: isPositioned ? 1 : 0}}
    >
      <h3>{title}</h3>
      <p>{content}</p>
      <button onClick={onPrev}>Back</button>
      <button onClick={onNext}>Next</button>
    </div>
  ),
);
```

**After**

```tsx
function MyTooltip({step, currentStep, totalSteps, onNext, onPrev, onClose, titleId, descriptionId}: TourTooltipProps) {
  return (
    <div className="my-tooltip">
      <h3 id={titleId}>{step.title}</h3>
      <div id={descriptionId}>{step.content}</div>
      <button onClick={onPrev}>Back</button>
      <button onClick={onNext}>Next</button>
    </div>
  );
}
```

`TourTooltipProps`:

| 0.x                                                                      | 1.0                                                                                                            |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `title`, `content`                                                       | `step.title`, `step.content`                                                                                   |
| `position`, `isPositioned`                                               | removed — the tour positions and reveals the tooltip                                                           |
| `onMeasured` (React Native)                                              | removed — the tour measures the tooltip                                                                        |
| `theme`, `i18n`                                                          | removed — use your own design tokens and texts in your component                                               |
| `currentStep`, `totalSteps`, `onNext`, `onPrev`, `onClose`, `onGoToStep` | unchanged                                                                                                      |
| —                                                                        | new: `placement` and `arrowOffset` (to draw an arrow), `titleId` and `descriptionId` (web, for screen readers) |

Remove positioning styles (`position: fixed/absolute`, `top`, `left`, `z-index`, `opacity` for hiding) from your tooltip. The card around your content provides the background, rounded corners and shadow from the theme.

## `OverlayComponent` and `platform` are removed

A custom overlay could not keep the guarantees 1.0 makes (the highlight follows the target while scrolling, clicks inside the highlight are ignored, the overlay is above everything). Colour the overlay with `theme.overlayColor`; on the web you can also style `.rtk-spotlight` (see [Styling with CSS](./README.md#styling-with-css-web)).

The `platform` prop (a custom platform adapter) is removed as well; each entry point has its platform built in.

## `onBeforeStep`: no polling, no delays

The tour now waits for the target to appear (up to 5 seconds, event-driven) after `onBeforeStep` finishes, and scrolls it into view. Remove polling loops and timeouts:

**Before**

```ts
onBeforeStep: async (target) => {
  navigate('/settings');
  while (!document.querySelector(target as string)) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
},
```

```ts
// React Native
onBeforeStep: async () => {
  navigation.navigate('Settings');
  await new Promise((resolve) => setTimeout(resolve, 300));
},
```

**After**

```ts
onBeforeStep() {
  navigate('/settings');
},
```

`onBeforeStep` now runs again when the user comes back to the step with Back, so make it idempotent (navigating to the page that is already open is fine; on the web, skip `navigate` when already on the path to avoid duplicate history entries). It also receives a second argument, `{signal}`, which is aborted when the step is abandoned.

If `onBeforeStep` throws or rejects, the tour ends with the new reason `'error'` (in 0.x the rejection went unhandled and the step never appeared).

## React Native

### Place `TourProvider` at the root and pass `insets`

1.0 draws the tour inside your app's root view instead of a React Native `<Modal>`. This fixes the white navigation-bar strip on Android with edge-to-edge, makes the highlight line up exactly, and lets the Android back button close the tour. For that, the provider has to fill the window:

**Before**

```tsx
<SafeAreaView style={{flex: 1}}>
  <TourProvider>
    <App />
  </TourProvider>
</SafeAreaView>
```

**After**

```tsx
function Root() {
  const insets = useSafeAreaInsets(); // react-native-safe-area-context
  return (
    <TourProvider insets={insets}>
      <SafeAreaView style={{flex: 1}}>
        <App />
      </SafeAreaView>
    </TourProvider>
  );
}
```

In development, a warning tells you when the provider does not fill the window.

### Native modal screens need a `<TourHost />`

Screens presented as native modals (react-navigation `presentation: 'modal'`, React Native `<Modal>`) are drawn above your root view. To highlight elements in them, render `<TourHost />` as the last child of the modal screen. See [Modal screens](./README.md#modal-screens).

### Scroll views

To let the tour scroll targets into view, register the scroll views around them with the new `useTourScrollView()` hook. Without it, steps whose target is off screen are skipped.

### Android navigation bar

To keep the navigation bar transparent behind the tour (no contrast scrim), set `enforceContrast: false` — see [Android navigation bar](./README.md#android-navigation-bar). The `statusBarTranslucent`/`navigationBarTranslucent` workarounds for the 0.x modal are no longer needed.

### `react-native-svg` is no longer needed

The overlay is drawn with plain views. Uninstall `react-native-svg` unless your app uses it elsewhere.

### Minimum version

React Native 0.79 (Expo SDK 53), whose Metro reads the package's `exports`. In TypeScript, `moduleResolution` must be `bundler`, `node16` or `nodenext` (the defaults of current React Native, Expo, Next.js and Vite projects).

## A new end reason: `'error'`

`TourEndReason` has a new member, `'error'`, used when `onBeforeStep` throws or rejects (`info.error` holds the error). A `switch` that TypeScript checks for exhaustiveness needs a new case.

## Missing targets

0.x checked for the target once, right after `onBeforeStep`; if it was not there yet it skipped to the next step — also when the user was going back — and ended the tour on the last step. 1.0 waits up to 5 seconds for the target to appear, then skips in the direction the user is going (with a warning in development). Going back past the first step returns to the step the user came from. The tour ends with `'target-missing'` only when no remaining step can be shown.

## Starting tours

- Calling `startTour` with the id of the tour that is already running does nothing (it used to restart it). This makes "start on mount" effects safe in Strict Mode.
- Starting a different tour while one is running ends the running one with the reason `'closed'`, so its `onTourEnd` callbacks run.

## Removed exports

These were internals and are no longer exported: `TourContext`, `TourOverlay`, `TourTooltip`, `TourOverlayProps`, `Rect`, `calculateTooltipPosition`, `findVisibleElement`, `webPlatformAdapter`, `nativePlatformAdapter`, `targetRegistry`, `MAX_VISIBLE_DOTS`, `DOT_SIZE`, `DOT_GAP`, `DOTS_CONTAINER_WIDTH`.

Still exported: `TourProvider`, `useTour`, `useTourTarget` (React Native), `getTruncatedDots` and the types `TourStep`, `TourTarget`, `TourContextType`, `TourProviderProps`, `TourTooltipProps`, `TourTheme`, `TourI18n`, `TourEndReason`, `TourEndInfo`, `TourEndCallback`, `StartTourOptions`, `DotItem`. New: the types `TourPlacement` and `TourStepContext`; `useTourScrollView`, `TourHost` and `TourInsets` (React Native).

`getTruncatedDots` returns ellipsis items with a `position` (`'start'` or `'end'`); `steps` in `useTour()` is now a `readonly` array.

## Changed defaults

| Setting                                   | 0.x                                                                         | 1.0                                                 |
| ----------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------- |
| `theme.primaryColor`                      | `'#3b82f6'`                                                                 | `'#2563eb'` (WCAG AA)                               |
| `theme.titleColor`                        | `'#1f2937'`                                                                 | `'#111827'`                                         |
| `i18n.finishLabel`                        | `'Finish'` (web), `'Done'` (React Native)                                   | `'Finish'`                                          |
| `i18n.stepCounterTemplate`                | `'{current} / {total}'` (web), `'Step {current} of {total}'` (React Native) | `'{current} of {total}'`                            |
| Page scrolling while a tour is open (web) | allowed                                                                     | blocked, so the step cannot be scrolled away        |
| Arrow keys (web)                          | captured globally, also while typing                                        | only while the tour has focus, never in text fields |

`i18n.closeAriaLabel` and `i18n.dotAriaLabelTemplate` are now used on React Native too.

## Step types

Steps can do more, so their types are wider. Writing steps needs no change; TypeScript code that _reads_ them may:

- `title` and `content` accept any React content (`ReactNode`), not only strings. Code that uses `step.title` as a `string` (for example `info.step.title` in analytics) has to handle other content, or keep its own string.
- `target` is optional: a step without a target is shown in the centre of the screen. `onBeforeStep` therefore receives `TourTarget | undefined`, plus a second argument `{signal}`; an annotated `(target: TourTarget) => …` becomes `(target: TourTarget | undefined) => …`.
- On the web, `target` can also be a ref to an element.

## Package format

The package is ESM-only, with the entry points `@robertlinde/react-tour-kit/react` and `@robertlinde/react-tour-kit/react-native` as before. Bundlers (Vite, webpack, Next.js, Metro) and Node's `import` work as before; 0.x's broken CommonJS entry is gone. Jest (CommonJS by default) has to transform the package, on the web and with React Native's preset (see [Testing your app](./README.md#testing-your-app)).
