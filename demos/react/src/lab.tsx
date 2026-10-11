import {type CSSProperties, type ReactNode, useEffect, useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {type TourPlacement, type TourStep, useTour} from '@robertlinde/react-tour-kit/react';

/**
 * Scenarios for the "never out of sight" end-to-end tests: `/lab?scenario=<name>&placement=<side>`.
 * Each renders a page with one target (`#lab-target`) and starts a one-step tour on it.
 */
const longText = 'This tooltip has a lot to say. '.repeat(60);

const target: CSSProperties = {
  width: 160,
  height: 48,
  background: '#c7d2fe',
  borderRadius: 8,
  display: 'grid',
  placeItems: 'center',
};

function Corner({style}: {readonly style: CSSProperties}): ReactNode {
  return (
    <div style={{position: 'relative', height: 'calc(100vh - 64px)'}}>
      <div id="lab-target" style={{...target, position: 'absolute', ...style}}>
        Target
      </div>
    </div>
  );
}

function Scenario({name}: {readonly name: string}): ReactNode {
  const [shifted, setShifted] = useState(false);
  useEffect(() => {
    if (name !== 'shift') {
      return undefined;
    }

    const timer = setTimeout(() => {
      setShifted(true);
    }, 800);
    return () => {
      clearTimeout(timer);
    };
  }, [name]);

  switch (name) {
    case 'top-left': {
      return <Corner style={{top: 0, left: 0}} />;
    }

    case 'top-right': {
      return <Corner style={{top: 0, right: 0}} />;
    }

    case 'bottom-left': {
      return <Corner style={{bottom: 0, left: 0}} />;
    }

    case 'bottom-right': {
      return <Corner style={{bottom: 0, right: 0}} />;
    }

    case 'left': {
      return <Corner style={{top: '45%', left: 0}} />;
    }

    case 'right': {
      return <Corner style={{top: '45%', right: 0}} />;
    }

    case 'below-fold': {
      return (
        <div style={{height: 3200, position: 'relative'}}>
          <div id="lab-target" style={{...target, position: 'absolute', top: 2500, left: '40%'}}>
            Target
          </div>
        </div>
      );
    }

    case 'nested': {
      return (
        <div>
          <div style={{height: 1400}} />
          <div
            data-testid="scroller"
            style={{height: 220, overflow: 'auto', border: '2px solid #a5b4fc', margin: '0 10%'}}
          >
            <div style={{height: 1200}} />
            <div id="lab-target" style={target}>
              Target
            </div>
            <div style={{height: 600}} />
          </div>
          <div style={{height: 1400}} />
        </div>
      );
    }

    case 'carousel': {
      return (
        <div
          data-testid="scroller"
          style={{display: 'flex', gap: 16, overflowX: 'auto', margin: '200px 5%', padding: 8}}
        >
          {Array.from({length: 12}, (_, index) => (
            <div key={index} style={{...target, flex: '0 0 220px', background: '#e0e7ff'}}>
              Card {index + 1}
            </div>
          ))}
          <div id="lab-target" style={{...target, flex: '0 0 220px'}}>
            Target
          </div>
        </div>
      );
    }

    case 'huge': {
      return (
        <div id="lab-target" style={{...target, width: '150vw', height: '150vh'}}>
          Huge target
        </div>
      );
    }

    case 'sticky': {
      return (
        <div>
          <header
            data-testid="sticky"
            style={{
              position: 'sticky',
              top: 0,
              height: 120,
              background: '#0f766e',
              color: 'white',
              zIndex: 2_147_483_647,
            }}
          >
            Sticky header
          </header>
          <div style={{height: 1600}} />
          <div id="lab-target" style={target}>
            Target
          </div>
          <div style={{height: 1600}} />
        </div>
      );
    }

    case 'sticky-up': {
      // The page starts scrolled past the target: the tour scrolls up, and must stop below the header.
      return (
        <div>
          <header
            data-testid="sticky"
            style={{position: 'sticky', top: 0, height: 100, background: '#0f766e', color: 'white', zIndex: 5}}
          >
            Sticky header
          </header>
          <div style={{height: 900}} />
          <div id="lab-target" style={{...target, height: 160}}>
            Target
          </div>
          <div style={{height: 3000}} />
        </div>
      );
    }

    case 'sticky-footer': {
      return (
        <div>
          <div style={{height: 2000}} />
          <div id="lab-target" style={target}>
            Target
          </div>
          <div style={{height: 2000}} />
          <footer
            style={{position: 'fixed', bottom: 0, left: 0, right: 0, height: 90, background: '#7c2d12', color: 'white'}}
          >
            Cookie banner
          </footer>
        </div>
      );
    }

    case 'floating': {
      // A floating button in the target's column, near the bottom.
      return (
        <div>
          <div style={{height: 2000}} />
          <div id="lab-target" style={{...target, marginLeft: 'auto', marginRight: 24}}>
            Target
          </div>
          <div style={{height: 2000}} />
          <button
            type="button"
            style={{position: 'fixed', right: 16, bottom: 16, width: 220, height: 160, borderRadius: 24}}
          >
            Chat with us
          </button>
        </div>
      );
    }

    case 'many': {
      return (
        <div>
          <header style={{position: 'sticky', top: 0, height: 70, background: '#1e3a8a', zIndex: 5}} />
          <div style={{height: 2200}} />
          <div id="lab-target" style={target}>
            Target
          </div>
          <div style={{height: 2200}} />
          <div style={{position: 'fixed', left: 0, right: 0, top: '45%', height: 40, background: '#a16207'}}>
            Announcement
          </div>
          <footer style={{position: 'fixed', bottom: 0, left: 0, right: 0, height: 60, background: '#7c2d12'}} />
        </div>
      );
    }

    case 'huge-sticky': {
      return (
        <div>
          <header style={{position: 'sticky', top: 0, height: 100, background: '#0f766e', zIndex: 5}} />
          <div style={{height: 1500}} />
          <div id="lab-target" style={{...target, width: '80vw', height: '160vh'}}>
            Huge target
          </div>
          <div style={{height: 1500}} />
        </div>
      );
    }

    case 'unavoidable': {
      // A short page that cannot scroll, with a fixed banner over part of the target.
      return (
        <div style={{height: '50vh', overflow: 'hidden', position: 'relative'}}>
          <div id="lab-target" style={{...target, position: 'absolute', top: 10, left: 40}}>
            Target
          </div>
          <div
            style={{position: 'fixed', top: 0, left: 0, right: 0, height: 40, background: '#7f1d1d', color: 'white'}}
          >
            Fixed banner
          </div>
        </div>
      );
    }

    case 'fixed-bottom': {
      return (
        <div style={{height: 2000}}>
          <div
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              height: 64,
              background: '#1e293b',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <div id="lab-target" style={target}>
              Target
            </div>
          </div>
        </div>
      );
    }

    case 'shift': {
      return (
        <div>
          {shifted ? (
            <div data-testid="inserted" style={{height: 300, background: '#fef3c7'}}>
              Inserted content
            </div>
          ) : null}
          <div style={{height: 300}} />
          <div id="lab-target" style={target}>
            Target
          </div>
          <div style={{height: 1600}} />
        </div>
      );
    }

    default: {
      return (
        <div style={{padding: 200}}>
          <div id="lab-target" style={target}>
            Target
          </div>
        </div>
      );
    }
  }
}

const placements = new Set<string>(['top', 'bottom', 'left', 'right']);

function isPlacement(value: string): value is TourPlacement {
  return placements.has(value);
}

export function Lab(): ReactNode {
  const [params] = useSearchParams();
  const name = params.get('scenario') ?? 'default';
  const placementParameter = params.get('placement') ?? 'bottom';
  const placement: TourPlacement = isPlacement(placementParameter) ? placementParameter : 'bottom';
  const {startTour} = useTour();

  useEffect(() => {
    if (name === 'sticky') {
      // Start with the target just under the sticky header.
      window.scrollTo({top: 1600 + 120 - 70, behavior: 'instant'});
    }

    if (name === 'sticky-up') {
      // Start well below the target, so the tour has to scroll up.
      window.scrollTo({top: 2500, behavior: 'instant'});
    }

    const step: TourStep =
      name === 'no-target'
        ? {title: 'Centred', content: 'A step without a target.'}
        : {
            target: '#lab-target',
            title: `Lab: ${name}`,
            content: name === 'long-content' ? longText : 'Always in sight.',
            placement,
          };
    startTour([step], `lab-${name}-${placement}`);
  }, [name, placement, startTour]);

  return (
    <div data-testid="lab" data-scenario={name}>
      <Scenario name={name} />
    </div>
  );
}
