import {type ReactNode, useEffect, useState} from 'react';
import {BrowserRouter, Link, Route, Routes, useNavigate} from 'react-router-dom';
import {TourProvider, type TourTheme, type TourTooltipProps, useTour} from '@robertlinde/react-tour-kit/react';
import {Lab} from './lab.tsx';
import {createDemoTour} from './tour.tsx';
import './App.css';

const darkTheme: TourTheme = {
  primaryColor: '#8b5cf6',
  tooltipBackground: '#1f2937',
  titleColor: '#f9fafb',
  contentColor: '#d1d5db',
  overlayColor: 'rgba(0, 0, 0, 0.7)',
};

/** A custom tooltip: only the content; the tour positions, animates and focuses it. */
function CompactTooltip({
  step,
  currentStep,
  totalSteps,
  onNext,
  onPrev,
  onClose,
  placement,
  arrowOffset,
  titleId,
  descriptionId,
}: TourTooltipProps): ReactNode {
  return (
    <div className="compact-tooltip" data-placement={placement}>
      {arrowOffset === undefined ? null : (
        <span
          className="compact-arrow"
          style={placement === 'top' || placement === 'bottom' ? {left: arrowOffset} : {top: arrowOffset}}
        />
      )}
      <strong id={titleId}>{step.title}</strong>
      <div id={descriptionId}>{step.content}</div>
      <div className="compact-actions">
        <button type="button" onClick={onClose}>
          Skip
        </button>
        <span>
          {currentStep + 1}/{totalSteps}
        </span>
        <button type="button" disabled={currentStep === 0} onClick={onPrev}>
          ←
        </button>
        <button type="button" onClick={onNext}>
          {currentStep === totalSteps - 1 ? 'Done' : '→'}
        </button>
      </div>
    </div>
  );
}

type Settings = {
  readonly dark: boolean;
  readonly rtl: boolean;
  readonly custom: boolean;
};

function Navigation({
  settings,
  onChange,
}: {
  readonly settings: Settings;
  readonly onChange: (next: Settings) => void;
}): ReactNode {
  return (
    <nav className="nav" data-tour="nav">
      <Link to="/" className="nav-link" data-tour="nav-home">
        Home
      </Link>
      <Link to="/settings" className="nav-link" data-tour="nav-settings">
        Settings
      </Link>
      <Link to="/lab" className="nav-link">
        Lab
      </Link>
      <span className="nav-spacer" />
      <label className="nav-toggle">
        <input
          type="checkbox"
          checked={settings.dark}
          onChange={(event) => {
            onChange({...settings, dark: event.target.checked});
          }}
        />{' '}
        Dark tour
      </label>
      <label className="nav-toggle">
        <input
          type="checkbox"
          checked={settings.rtl}
          onChange={(event) => {
            onChange({...settings, rtl: event.target.checked});
          }}
        />{' '}
        RTL
      </label>
      <label className="nav-toggle">
        <input
          type="checkbox"
          checked={settings.custom}
          onChange={(event) => {
            onChange({...settings, custom: event.target.checked});
          }}
        />{' '}
        Custom tooltip
      </label>
    </nav>
  );
}

function HomePage(): ReactNode {
  const {startTour, isActive, currentStep, steps} = useTour();
  const navigate = useNavigate();

  return (
    <div className="page">
      <header className="header" data-tour="header">
        <h1>react-tour-kit</h1>
        <p className="tagline">Guided tours for React and React Native that never leave the screen</p>
      </header>

      <main className="main">
        <section className="features">
          <h2>Features</h2>
          <div className="feature-grid">
            <div className="feature-card" data-tour="feature-1">
              <div className="feature-icon">&#128640;</div>
              <h3>Simple</h3>
              <p>Wrap your app in TourProvider, call startTour from useTour. That&apos;s the whole API.</p>
            </div>
            <div className="feature-card" data-tour="feature-2">
              <div className="feature-icon">&#127919;</div>
              <h3>Always in sight</h3>
              <p>Targets are scrolled into view; the tooltip is guaranteed to stay on screen.</p>
            </div>
            <div className="feature-card" data-tour="feature-3">
              <div className="feature-icon">&#9855;</div>
              <h3>Accessible</h3>
              <p>A real modal dialog: focus moves in and back, keyboard navigation, screen-reader friendly.</p>
            </div>
          </div>
        </section>

        <section className="cta-section">
          <button
            type="button"
            className="cta-button"
            data-tour="cta"
            onClick={() => {
              startTour(createDemoTour(navigate), 'demo');
            }}
          >
            {isActive ? `Step ${currentStep + 1} of ${steps.length}` : 'Start the tour'}
          </button>
        </section>

        <div className="spacer" aria-hidden="true" />

        <section className="install-section" data-tour="install">
          <h2>Installation</h2>
          <code className="install-code">npm i @robertlinde/react-tour-kit</code>
        </section>
      </main>
    </div>
  );
}

function SettingsPage(): ReactNode {
  return (
    <div className="page">
      <header className="header settings-header" data-tour="settings-header">
        <h1>Settings</h1>
        <p className="tagline">Configure your preferences</p>
      </header>

      <main className="main">
        <section className="settings-section">
          <h2>Preferences</h2>

          <div className="setting-card" data-tour="theme-toggle">
            <div className="setting-info">
              <h3>Dark mode</h3>
              <p>Toggle between light and dark theme</p>
            </div>
            <button type="button" className="toggle-button">
              Toggle
            </button>
          </div>

          <div className="setting-card" data-tour="notifications">
            <div className="setting-info">
              <h3>Notifications</h3>
              <p>Manage notification preferences</p>
            </div>
            <button type="button" className="toggle-button">
              Configure
            </button>
          </div>

          <h2>Advanced</h2>
          <div className="advanced-panel" data-testid="advanced-panel">
            {Array.from({length: 12}, (_, index) => (
              <div key={index} className="setting-card">
                <div className="setting-info">
                  <h3>Option {index + 1}</h3>
                  <p>A setting you rarely need</p>
                </div>
              </div>
            ))}
            <div className="setting-card" data-tour="advanced">
              <div className="setting-info">
                <h3>Experimental features</h3>
                <p>Deep inside a scrollable panel</p>
              </div>
              <button type="button" className="toggle-button">
                Enable
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function App(): ReactNode {
  // `?dir=rtl` starts in right-to-left mode (used by the end-to-end tests).
  const [settings, setSettings] = useState<Settings>(() => ({
    dark: false,
    rtl: new URLSearchParams(window.location.search).get('dir') === 'rtl',
    custom: false,
  }));

  useEffect(() => {
    document.documentElement.dir = settings.rtl ? 'rtl' : 'ltr';
  }, [settings.rtl]);

  return (
    <BrowserRouter>
      <TourProvider
        theme={settings.dark ? darkTheme : undefined}
        TooltipComponent={settings.custom ? CompactTooltip : undefined}
        onTourEnd={(tourId, info) => {
          console.info('Tour ended', tourId, info.reason, `at step ${info.stepIndex + 1} of ${info.totalSteps}`);
        }}
      >
        <div className="app">
          <Navigation settings={settings} onChange={setSettings} />
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/lab" element={<Lab />} />
          </Routes>
          <footer className="footer">
            <p>
              <a href="https://github.com/robertlinde/react-tour-kit" target="_blank" rel="noopener noreferrer">
                GitHub
              </a>
              {' | '}
              <a
                href="https://www.npmjs.com/package/@robertlinde/react-tour-kit"
                target="_blank"
                rel="noopener noreferrer"
              >
                npm
              </a>
            </p>
          </footer>
        </div>
      </TourProvider>
    </BrowserRouter>
  );
}

export default App;
