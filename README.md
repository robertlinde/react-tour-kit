# react-tour-kit

Cross-platform guided tour library for React and React Native. Build interactive onboarding experiences with customizable tooltips, smart positioning, cross-page navigation, and async step actions. Fully themeable with TypeScript support.

## Features

- **Cross-Platform**: Works with React (web) and React Native
- **Cross-Page Tours**: Navigate between pages/screens during a tour
- **Themeable**: Customize colors without building custom components
- **Fully Customizable**: Replace the default tooltip and overlay with your own components
- **Smart Positioning**: Automatic tooltip positioning with viewport boundary detection
- **Keyboard Navigation**: Arrow keys and Escape (web) or hardware back button (Android)
- **Async Step Actions**: Run async code before each step (e.g., navigate, switch tabs, open dialogs)
- **TypeScript First**: Full TypeScript support

## Installation

```bash
npm install @robertlinde/react-tour-kit
```

## Live Demos

Try the demos locally:

```bash
# Web demo (React + React Router)
cd demos/react
npm install
npm run dev

# React Native demo (Expo + React Navigation)
cd demos/react-native
npm install
npm run ios  # or npm run android
```

## Platform Guide

| Platform         | Import from                   | Target elements with                          |
| ---------------- | ----------------------------- | --------------------------------------------- |
| **React (Web)**  | `react-tour-kit/react`        | CSS selectors (e.g., `[data-tour="welcome"]`) |
| **React Native** | `react-tour-kit/react-native` | `useTourTarget` hook or refs                  |

---

## React (Web)

### Quick Start

#### 1. Wrap your app with TourProvider

```tsx
import {TourProvider} from '@robertlinde/react-tour-kit/react';

function App() {
  return (
    <TourProvider>
      <YourApp />
    </TourProvider>
  );
}
```

#### 2. Add data attributes to target elements

```tsx
function Dashboard() {
  return (
    <div>
      <header data-tour="welcome">
        <h1>Dashboard</h1>
      </header>

      <nav data-tour="sidebar">{/* Navigation items */}</nav>

      <button data-tour="settings">Settings</button>
    </div>
  );
}
```

#### 3. Start a tour

```tsx
import {useTour, type TourStep} from '@robertlinde/react-tour-kit/react';

const tourSteps: TourStep[] = [
  {
    target: '[data-tour="welcome"]', // CSS selector
    title: 'Welcome!',
    content: 'This is your dashboard. Let me show you around.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="sidebar"]',
    title: 'Navigation',
    content: 'Use the sidebar to navigate between different sections.',
    placement: 'right',
  },
  {
    target: '[data-tour="settings"]',
    title: 'Settings',
    content: 'Click here to customize your preferences.',
    placement: 'left',
  },
];

function WelcomeButton() {
  const {startTour} = useTour();

  return <button onClick={() => startTour(tourSteps, 'onboarding')}>Start Tour</button>;
}
```

### Keyboard Navigation (Web)

| Key             | Action        |
| --------------- | ------------- |
| `→` Arrow Right | Next step     |
| `←` Arrow Left  | Previous step |
| `Escape`        | Close tour    |

---

## React Native

### Quick Start

#### 1. Wrap your app with TourProvider

```tsx
import {TourProvider} from '@robertlinde/react-tour-kit/react-native';

function App() {
  return (
    <TourProvider>
      <YourApp />
    </TourProvider>
  );
}
```

#### 2. Register target elements with useTourTarget

```tsx
import {View} from 'react-native';
import {useTourTarget} from '@robertlinde/react-tour-kit/react-native';

function MyComponent() {
  const welcomeRef = useTourTarget<View>('welcome-button');
  const settingsRef = useTourTarget<View>('settings-button');

  return (
    <View>
      <TouchableOpacity ref={welcomeRef}>
        <Text>Welcome</Text>
      </TouchableOpacity>

      <TouchableOpacity ref={settingsRef}>
        <Text>Settings</Text>
      </TouchableOpacity>
    </View>
  );
}
```

#### 3. Start a tour

```tsx
import {useTour, type TourStep} from '@robertlinde/react-tour-kit/react-native';

const tourSteps: TourStep[] = [
  {
    target: 'welcome-button', // String ID from useTourTarget
    title: 'Welcome!',
    content: 'This is your dashboard. Let me show you around.',
    placement: 'bottom',
  },
  {
    target: 'settings-button',
    title: 'Settings',
    content: 'Tap here to customize your preferences.',
    placement: 'left',
  },
];

function StartTourButton() {
  const {startTour} = useTour();

  return (
    <TouchableOpacity onPress={() => startTour(tourSteps, 'onboarding')}>
      <Text>Start Tour</Text>
    </TouchableOpacity>
  );
}
```

### Using Refs Directly (React Native)

You can also pass refs directly instead of string IDs:

```tsx
import {useRef} from 'react';
import {useTour, type TourStep} from '@robertlinde/react-tour-kit/react-native';

function MyComponent() {
  const buttonRef = useRef(null);

  const steps: TourStep[] = [
    {
      target: buttonRef, // Pass ref directly
      title: 'Welcome!',
      content: 'Tap here to get started.',
    },
  ];

  return <TouchableOpacity ref={buttonRef}>...</TouchableOpacity>;
}
```

### Navigation (React Native)

| Action        | Trigger                                           |
| ------------- | ------------------------------------------------- |
| Next step     | Tap "Next" button                                 |
| Previous step | Tap "Back" button                                 |
| Close tour    | Tap close button, overlay, or Android back button |

---

## Cross-Page/Cross-Screen Tours

Tours can span multiple pages (web) or screens (React Native). The key is to:

1. Wrap your **router/navigator** with `TourProvider`
2. Use `onBeforeStep` to navigate before showing a step

### Web (React Router)

```tsx
import {BrowserRouter, useNavigate} from 'react-router-dom';
import {TourProvider, useTour, type TourStep} from '@robertlinde/react-tour-kit/react';

// TourProvider wraps the router
function App() {
  return (
    <TourProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </BrowserRouter>
    </TourProvider>
  );
}

// Define steps with navigation
function Home() {
  const navigate = useNavigate();
  const {startTour} = useTour();

  const steps: TourStep[] = [
    {
      target: '[data-tour="welcome"]',
      title: 'Welcome',
      content: 'Let me show you around.',
      placement: 'bottom',
    },
    {
      target: '[data-tour="nav-settings"]',
      title: 'Settings Link',
      content: "Now let's visit the settings page.",
      placement: 'bottom',
      // Navigate before the NEXT step shows
      onBeforeStep: async () => {
        navigate('/settings');
        await new Promise((r) => setTimeout(r, 100)); // Wait for navigation
      },
    },
    {
      target: '[data-tour="theme-toggle"]',
      title: 'Theme Settings',
      content: 'This element is on the Settings page!',
      placement: 'right',
    },
    {
      target: '[data-tour="welcome"]',
      title: 'Back Home',
      content: 'And we can navigate back.',
      placement: 'bottom',
      onBeforeStep: async () => {
        navigate('/');
        await new Promise((r) => setTimeout(r, 100));
      },
    },
  ];

  return <button onClick={() => startTour(steps, 'cross-page')}>Start Tour</button>;
}
```

### React Native (React Navigation)

```tsx
import {NavigationContainer, useNavigation} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {TourProvider, useTour, useTourTarget, type TourStep} from '@robertlinde/react-tour-kit/react-native';

const Stack = createNativeStackNavigator();

// TourProvider wraps the navigator
function App() {
  return (
    <TourProvider>
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </TourProvider>
  );
}

// Define steps with navigation
function HomeScreen() {
  const navigation = useNavigation();
  const {startTour} = useTour();
  const headerRef = useTourTarget<View>('header');

  const steps: TourStep[] = [
    {
      target: 'header',
      title: 'Welcome',
      content: 'Let me show you around.',
      placement: 'bottom',
    },
    {
      target: 'settings-header',
      title: 'Settings Screen',
      content: 'This element is on the Settings screen!',
      placement: 'bottom',
      onBeforeStep: async () => {
        navigation.navigate('Settings');
        await new Promise((r) => setTimeout(r, 300)); // Wait for animation
      },
    },
    {
      target: 'header',
      title: 'Back Home',
      content: 'And we can navigate back.',
      placement: 'bottom',
      onBeforeStep: async () => {
        navigation.navigate('Home');
        await new Promise((r) => setTimeout(r, 300));
      },
    },
  ];

  return (
    <View>
      <View ref={headerRef}>{/* ... */}</View>
      <Button onPress={() => startTour(steps, 'cross-screen')} title="Start Tour" />
    </View>
  );
}

function SettingsScreen() {
  const headerRef = useTourTarget<View>('settings-header');

  return <View ref={headerRef}>{/* ... */}</View>;
}
```

### Important Notes for Cross-Page Tours

1. **TourProvider placement**: Must wrap your router/navigator so tour state persists across navigation
2. **Target availability**: Targets must be mounted when their step is active. Use `onBeforeStep` to navigate first
3. **Wait for navigation**: Add a small delay after navigation to ensure the new page/screen is rendered
4. **Persistent elements**: Elements like navigation bars that exist on all pages don't need `onBeforeStep`

---

## API Reference

### TourProvider

The provider component that enables tour functionality throughout your app.

```tsx
import {TourProvider} from '@robertlinde/react-tour-kit/react';

<TourProvider
  TooltipComponent={CustomTooltip} // Optional: custom tooltip component
  OverlayComponent={CustomOverlay} // Optional: custom overlay component
  theme={theme} // Optional: theme configuration
  onTourEnd={(tourId) => {
    // Optional: callback when tour ends
    console.log(`Tour ${tourId} completed`);
  }}
>
  {children}
</TourProvider>;
```

#### Props

| Prop               | Type                                          | Description                                         |
| ------------------ | --------------------------------------------- | --------------------------------------------------- |
| `children`         | `ReactNode`                                   | Your application content                            |
| `theme`            | `TourTheme`                                   | Theme configuration for colors (see Theming below)  |
| `TooltipComponent` | `ForwardRefExoticComponent<TourTooltipProps>` | Custom tooltip component (must use forwardRef)      |
| `OverlayComponent` | `ComponentType<TourOverlayProps>`             | Custom overlay component                            |
| `onTourEnd`        | `(tourId: string \| null) => void`            | Callback fired when tour ends (completed or closed) |

### useTour Hook

Access the tour context from any component.

```tsx
import {useTour} from '@robertlinde/react-tour-kit/react';

function MyComponent() {
  const {
    isActive, // boolean: is a tour currently running?
    currentStep, // number: current step index (0-based)
    steps, // TourStep[]: all steps in current tour
    currentTourId, // string | null: ID of current tour
    startTour, // (steps: TourStep[], tourId?: string) => void
    endTour, // () => void
    nextStep, // () => void
    prevStep, // () => void
    goToStep, // (step: number) => void
  } = useTour();
}
```

### TourStep

Define the steps in your tour.

```tsx
type TourStep = {
  target: TourTarget; // Target element (see below)
  title: string; // Step title
  content: string; // Step description/content
  placement?: 'top' | 'bottom' | 'left' | 'right'; // Tooltip position (default: 'bottom')
  onBeforeStep?: () => void | Promise<void>; // Async action before showing step
};

// Target types differ by platform:
// Web: CSS selector string (e.g., '[data-tour="welcome"]', '#my-button')
// React Native: String ID (registered via useTourTarget) or RefObject
type TourTarget = string | RefObject<unknown>;
```

## Theming

Customize the look of the default tooltip and overlay without building custom components.

### Theme Options

```tsx
import {TourProvider, type TourTheme} from '@robertlinde/react-tour-kit/react';

const theme: TourTheme = {
  primaryColor: '#10b981', // Buttons, step badge, highlight border (default: '#3b82f6')
  tooltipBackground: '#ffffff', // Tooltip background color (default: '#ffffff')
  titleColor: '#1f2937', // Title text color (default: '#1f2937')
  contentColor: '#4b5563', // Body text color (default: '#4b5563')
  overlayColor: 'rgba(0, 0, 0, 0.5)', // Semi-transparent overlay (default: 'rgba(0, 0, 0, 0.5)')
};

function App() {
  return (
    <TourProvider theme={theme}>
      <YourApp />
    </TourProvider>
  );
}
```

### Theme Examples

**Dark theme:**

```tsx
const darkTheme: TourTheme = {
  primaryColor: '#8b5cf6',
  tooltipBackground: '#1f2937',
  titleColor: '#f9fafb',
  contentColor: '#d1d5db',
  overlayColor: 'rgba(0, 0, 0, 0.7)',
};
```

**Brand colors:**

```tsx
const brandTheme: TourTheme = {
  primaryColor: '#your-brand-color',
};
// Other values use defaults
```

### React Native

Theming works the same way in React Native:

```tsx
import {TourProvider, type TourTheme} from '@robertlinde/react-tour-kit/react-native';

const theme: TourTheme = {
  primaryColor: '#10b981',
  overlayColor: 'rgba(0, 0, 0, 0.7)',
};

function App() {
  return (
    <TourProvider theme={theme}>
      <YourApp />
    </TourProvider>
  );
}
```

---

## Advanced Usage

### Async Step Actions

Run code before a step is shown. Useful for opening dialogs, switching tabs, navigating, etc.

```tsx
const steps: TourStep[] = [
  {
    target: '[data-tour="settings-tab"]',
    title: 'Settings Tab',
    content: 'Click here to access settings.',
  },
  {
    target: '[data-tour="notifications-panel"]',
    title: 'Notifications',
    content: 'Configure your notification preferences here.',
    onBeforeStep: async () => {
      // Open the settings tab before showing this step
      document.querySelector('[data-tour="settings-tab"]')?.click();
      // Wait for the panel to appear
      await new Promise((resolve) => setTimeout(resolve, 300));
    },
  },
];
```

### Custom Tooltip Component

Create your own tooltip with your design system.

**Web:**

```tsx
import {forwardRef} from 'react';
import {TourProvider, type TourTooltipProps} from '@robertlinde/react-tour-kit/react';

const CustomTooltip = forwardRef<HTMLDivElement, TourTooltipProps>(
  ({title, content, currentStep, totalSteps, position, isPositioned, onClose, onNext, onPrev}, ref) => (
    <div
      ref={ref}
      className="custom-tooltip"
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        opacity: isPositioned ? 1 : 0,
      }}
    >
      <h3>{title}</h3>
      <p>{content}</p>
      <div className="tooltip-footer">
        <span>
          {currentStep + 1} of {totalSteps}
        </span>
        <button onClick={onPrev} disabled={currentStep === 0}>
          Back
        </button>
        <button onClick={onNext}>{currentStep === totalSteps - 1 ? 'Finish' : 'Next'}</button>
        <button onClick={onClose}>×</button>
      </div>
    </div>
  ),
);

function App() {
  return (
    <TourProvider TooltipComponent={CustomTooltip}>
      <YourApp />
    </TourProvider>
  );
}
```

**React Native:**

```tsx
import {forwardRef} from 'react';
import {View, Text, TouchableOpacity} from 'react-native';
import {TourProvider, type TourTooltipProps} from '@robertlinde/react-tour-kit/react-native';

const CustomTooltip = forwardRef<View, TourTooltipProps>(
  ({title, content, position, isPositioned, onNext, onClose}, ref) => (
    <View
      ref={ref}
      style={{
        position: 'absolute',
        top: position.top,
        left: position.left,
        opacity: isPositioned ? 1 : 0,
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 8,
      }}
    >
      <Text style={{fontWeight: 'bold'}}>{title}</Text>
      <Text>{content}</Text>
      <TouchableOpacity onPress={onNext}>
        <Text>Next</Text>
      </TouchableOpacity>
    </View>
  ),
);

function App() {
  return (
    <TourProvider TooltipComponent={CustomTooltip}>
      <YourApp />
    </TourProvider>
  );
}
```

### Custom Overlay Component

Customize the backdrop overlay.

**Web:**

```tsx
import {TourProvider, type TourOverlayProps} from '@robertlinde/react-tour-kit/react';

function CustomOverlay({highlightRect, onClose}: TourOverlayProps) {
  return (
    <div className="custom-overlay" onClick={onClose}>
      <div
        className="highlight-border"
        style={{
          position: 'absolute',
          top: highlightRect.top - 4,
          left: highlightRect.left - 4,
          width: highlightRect.width + 8,
          height: highlightRect.height + 8,
          border: '2px solid #your-brand-color',
          borderRadius: '8px',
        }}
      />
    </div>
  );
}

function App() {
  return (
    <TourProvider OverlayComponent={CustomOverlay}>
      <YourApp />
    </TourProvider>
  );
}
```

**React Native:**

```tsx
import {View, TouchableWithoutFeedback, StyleSheet} from 'react-native';
import {TourProvider, type TourOverlayProps} from '@robertlinde/react-tour-kit/react-native';

function CustomOverlay({highlightRect, onClose}: TourOverlayProps) {
  return (
    <TouchableWithoutFeedback onPress={onClose}>
      <View style={StyleSheet.absoluteFill}>
        {/* Your custom overlay with cutout */}
        <View
          style={{
            position: 'absolute',
            top: highlightRect.top - 4,
            left: highlightRect.left - 4,
            width: highlightRect.width + 8,
            height: highlightRect.height + 8,
            borderWidth: 2,
            borderColor: '#your-brand-color',
            borderRadius: 8,
          }}
        />
      </View>
    </TouchableWithoutFeedback>
  );
}

function App() {
  return (
    <TourProvider OverlayComponent={CustomOverlay}>
      <YourApp />
    </TourProvider>
  );
}
```

### Persisting Tour Completion

Track which tours users have completed:

```tsx
import {TourProvider} from '@robertlinde/react-tour-kit/react';

function App() {
  const handleTourEnd = async (tourId: string | null) => {
    if (tourId) {
      // Save to your backend
      await fetch('/api/users/me/completed-tours/' + tourId, {
        method: 'POST',
      });
    }
  };

  return (
    <TourProvider onTourEnd={handleTourEnd}>
      <YourApp />
    </TourProvider>
  );
}
```

### Conditional Tour Start

Start tours based on user state:

```tsx
function TourTrigger({tourId, steps, autoStart = true}) {
  const {startTour} = useTour();
  const {user} = useUser(); // Your auth hook

  useEffect(() => {
    if (autoStart && user && !user.completedTours?.[tourId]) {
      // Auto-start if user hasn't completed this tour
      setTimeout(() => startTour(steps, tourId), 500);
    }
  }, [user, tourId, autoStart]);

  return <button onClick={() => startTour(steps, tourId)}>Start Tour</button>;
}
```

## Styling

The default components use inline styles for zero-dependency styling. You have three options for customization:

1. **Theming**: Use the `theme` prop to customize colors (see [Theming](#theming) section)
2. **Custom Components**: Provide your own `TooltipComponent` and `OverlayComponent` for full control
3. **CSS Overrides** (Web only): Override styles via CSS selectors

## Platform Support

**Web:**

- Chrome, Firefox, Safari, Edge (latest versions)

**React Native:**

- iOS 13+
- Android 5.0+ (API 21+)
- React Native 0.70+

Requires React 18+.

## TypeScript

Full TypeScript support is included. Import types as needed:

```tsx
import type {
  TourStep,
  TourContextType,
  TourProviderProps,
  TourTooltipProps,
  TourOverlayProps,
  TourTheme,
} from '@robertlinde/react-tour-kit/react';
```

## Utilities

The package exports utility functions for custom implementations:

```tsx
import {
  calculateTooltipPosition, // Calculate optimal tooltip position
  findVisibleElement, // Find first visible element matching selector
} from '@robertlinde/react-tour-kit/react';
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run start:dev

# Lint
npm run lint

# Format
npm run format

# Run web demo
cd demos/react && npm install && npm run dev

# Run native demo
cd demos/react-native && npm install && npm run ios
```

## License

MIT
