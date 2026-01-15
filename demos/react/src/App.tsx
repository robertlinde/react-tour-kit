import React from 'react';
import {BrowserRouter, Routes, Route, Link, useNavigate} from 'react-router-dom';
import {useTour, type TourStep} from '@robertlinde/react-tour-kit/react';
import './App.css';

// Tour steps that span multiple pages
const createTourSteps = (navigate: (path: string) => void): TourStep[] => [
  {
    target: '[data-tour="header"]',
    title: 'Welcome to React Tour!',
    content: "This demo showcases cross-page tours. Let's explore!",
    placement: 'bottom',
  },
  {
    target: '[data-tour="nav-home"]',
    title: 'Navigation',
    content: 'Use these links to navigate between pages.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="feature-1"]',
    title: 'Easy to Use',
    content: 'Just wrap your app with TourProvider and add data-tour attributes.',
    placement: 'right',
  },
  {
    target: '[data-tour="nav-settings"]',
    title: "Let's Visit Settings",
    content: "Now we'll navigate to the Settings page to continue the tour.",
    placement: 'bottom',
    async onBeforeStep() {
      navigate('/settings');
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 100);
      });
    },
  },
  {
    target: '[data-tour="settings-header"]',
    title: 'Settings Page',
    content: "We've navigated to a different page! The tour continues seamlessly.",
    placement: 'bottom',
  },
  {
    target: '[data-tour="theme-toggle"]',
    title: 'Theme Settings',
    content: 'Tours can highlight elements on any page in your app.',
    placement: 'right',
  },
  {
    target: '[data-tour="nav-home"]',
    title: 'Back to Home',
    content: "Let's go back to the home page to finish up.",
    placement: 'bottom',
    async onBeforeStep() {
      navigate('/');
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 100);
      });
    },
  },
  {
    target: '[data-tour="cta"]',
    title: "That's It!",
    content: "You've completed a cross-page tour. The TourProvider wraps your router to make this work.",
    placement: 'top',
  },
];

function Navigation(): React.JSX.Element {
  return (
    <nav className="nav">
      <Link to="/" className="nav-link" data-tour="nav-home">
        Home
      </Link>
      <Link to="/settings" className="nav-link" data-tour="nav-settings">
        Settings
      </Link>
    </nav>
  );
}

function HomePage(): React.JSX.Element {
  const {startTour, isActive, currentStep, steps} = useTour();
  const navigate = useNavigate();

  const handleStartTour = (): void => {
    navigate('/');
    setTimeout(() => {
      startTour(createTourSteps(navigate), 'cross-page-tour');
    }, 50);
  };

  return (
    <div className="page">
      <header className="header" data-tour="header">
        <h1>react-tour-kit</h1>
        <p className="tagline">A flexible, customizable tour component for React</p>
      </header>

      <main className="main">
        <section className="features" data-tour="features">
          <h2>Features</h2>
          <div className="feature-grid">
            <div className="feature-card" data-tour="feature-1">
              <div className="feature-icon">&#128640;</div>
              <h3>Easy to Use</h3>
              <p>Simple API with TourProvider and useTour hook. Just add data attributes to your elements.</p>
            </div>
            <div className="feature-card" data-tour="feature-2">
              <div className="feature-icon">&#127912;</div>
              <h3>Customizable</h3>
              <p>Theme support, custom tooltip and overlay components. Make it match your brand.</p>
            </div>
            <div className="feature-card" data-tour="feature-3">
              <div className="feature-icon">&#128241;</div>
              <h3>Cross-Platform</h3>
              <p>Works with React (web) and React Native. One API, multiple platforms.</p>
            </div>
          </div>
        </section>

        <section className="cta-section">
          <button type="button" className="cta-button" data-tour="cta" onClick={handleStartTour}>
            {isActive ? `Step ${String(currentStep + 1)} of ${String(steps.length)}` : 'Start Cross-Page Tour'}
          </button>
        </section>

        <section className="install-section">
          <h2>Installation</h2>
          <code className="install-code">npm i @robertlinde/react-tour-kit</code>
        </section>
      </main>
    </div>
  );
}

function SettingsPage(): React.JSX.Element {
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
              <h3>Dark Mode</h3>
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

          <div className="setting-card">
            <div className="setting-info">
              <h3>Language</h3>
              <p>Select your preferred language</p>
            </div>
            <button type="button" className="toggle-button">
              English
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

function AppContent(): React.JSX.Element {
  return (
    <div className="app">
      <Navigation />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
      <footer className="footer">
        <p>
          <a href="https://github.com/robertlinde/react-tour-kit" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
          {' | '}
          <a href="https://www.npmjs.com/package/@robertlinde/react-tour-kit" target="_blank" rel="noopener noreferrer">
            npm
          </a>
        </p>
      </footer>
    </div>
  );
}

function App(): React.JSX.Element {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
