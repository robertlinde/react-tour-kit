import {type ReactNode, useEffect} from 'react';
import {createHashRouter, NavLink, Outlet, RouterProvider, ScrollRestoration} from 'react-router-dom';
import {TourProvider, type TourTheme, useTour} from '@robertlinde/react-tour-kit/react';
import {Icon, type IconName} from './icons.tsx';
import {DashboardPage, ProjectsPage, SettingsPage, TeamPage} from './pages.tsx';
import {createShowcaseTour} from './tour.ts';

/** The tour in the app's own brand colour. */
const theme: TourTheme = {
  primaryColor: '#4f46e5',
  overlayColor: 'rgba(15, 23, 42, 0.55)',
};

const navigation: ReadonlyArray<{readonly path: string; readonly label: string; readonly icon: IconName}> = [
  {path: '/', label: 'Dashboard', icon: 'dashboard'},
  {path: '/projects', label: 'Projects', icon: 'projects'},
  {path: '/team', label: 'Team', icon: 'team'},
  {path: '/settings', label: 'Settings', icon: 'settings'},
];

function Layout(): ReactNode {
  const {startTour} = useTour();

  // Like a real onboarding: the tour starts by itself shortly after the app has loaded.
  useEffect(() => {
    const timer = setTimeout(() => {
      startTour(tour, 'onboarding');
    }, 1000);
    return () => {
      clearTimeout(timer);
    };
  }, [startTour]);

  const links = navigation.map((item) => (
    <NavLink key={item.path} to={item.path} end className="nav-item">
      <Icon name={item.icon} />
      {item.label}
    </NavLink>
  ));

  return (
    <div className="shell">
      <aside className="sidebar">
        <span className="brand">
          <span className="brand-mark">
            <Icon name="logo" size={16} />
          </span>
          Acme
        </span>
        <nav aria-label="Main">{links}</nav>
        <a className="built-with" href="https://github.com/robertlinde/react-tour-kit">
          Built with <strong>react-tour-kit</strong>
        </a>
      </aside>

      <div className="main">
        <header className="topbar">
          <span className="brand-mark brand-mark-compact" aria-hidden="true">
            <Icon name="logo" size={16} />
          </span>
          <label className="search" data-tour="search">
            <Icon name="search" size={16} />
            <input type="search" placeholder="Search Acme" aria-label="Search" />
          </label>
          <button
            type="button"
            className="button button-ghost"
            data-tour="help"
            aria-label="Help"
            onClick={() => {
              startTour(tour, 'onboarding');
            }}
          >
            <Icon name="help" />
            <span className="button-label">Help</span>
          </button>
          <button type="button" className="icon-button hide-compact" aria-label="Notifications">
            <Icon name="bell" />
          </button>
          <span className="avatar avatar-me hide-compact" aria-hidden="true">
            SO
          </span>
          <button type="button" className="button button-primary" data-tour="new-project" aria-label="New project">
            <Icon name="plus" size={16} />
            <span className="button-label">New project</span>
          </button>
        </header>

        <nav className="tabs" aria-label="Main">
          {links}
        </nav>

        <main className="content">
          <Outlet />
        </main>
      </div>

      <ScrollRestoration />
    </div>
  );
}

const router = createHashRouter([
  {
    element: <Layout />,
    children: [
      {path: '/', element: <DashboardPage />},
      {path: '/projects', element: <ProjectsPage />},
      {path: '/team', element: <TeamPage />},
      {path: '/settings', element: <SettingsPage />},
    ],
  },
]);

const tour = createShowcaseTour((path) => {
  if (router.state.location.pathname !== path) {
    void router.navigate(path);
  }
});

export function App(): ReactNode {
  return (
    <TourProvider theme={theme}>
      <RouterProvider router={router} />
    </TourProvider>
  );
}
