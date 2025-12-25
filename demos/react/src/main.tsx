import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {TourProvider} from 'react-tour-kit/react';
import './index.css';
import App from './app.tsx';

const rootElement = document.querySelector('#root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <TourProvider>
        <App />
      </TourProvider>
    </StrictMode>,
  );
}
