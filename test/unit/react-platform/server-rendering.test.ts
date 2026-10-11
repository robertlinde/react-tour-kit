import {createElement} from 'react';
import {renderToString} from 'react-dom/server';
import {describe, expect, it} from 'vitest';
import {TourProvider, useTour} from '../../../src/react.js';

describe('server rendering', () => {
  it('renders the app without touching the DOM and without tour markup', () => {
    function App(): ReturnType<typeof createElement> {
      const {isActive} = useTour();
      return createElement('main', null, isActive ? 'touring' : 'idle');
    }

    const html = renderToString(createElement(TourProvider, null, createElement(App)));
    expect(html).toBe('<main>idle</main>');
  });
});
