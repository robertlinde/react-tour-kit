'use client';

import {type JSX} from 'react';
import {type TourOverlayProps} from '../../shared';

const highlightPadding = 8;
const borderRadius = 8;

export function TourOverlay({highlightRect, onClose, theme}: TourOverlayProps): JSX.Element {
  // Convert hex color to rgba for box shadow
  const primaryColorRgba = `${theme.primaryColor}4D`; // 30% opacity

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
      }}
      onClick={onClose}
    >
      <svg
        style={{
          position: 'absolute',
          inset: 0,
          height: '100%',
          width: '100%',
        }}
      >
        <defs>
          <mask id="tour-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <rect
              x={highlightRect.left - highlightPadding}
              y={highlightRect.top - highlightPadding}
              width={highlightRect.width + highlightPadding * 2}
              height={highlightRect.height + highlightPadding * 2}
              rx={borderRadius}
              fill="black"
            />
          </mask>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" fill={theme.overlayColor} mask="url(#tour-mask)" />
      </svg>

      <div
        style={{
          position: 'absolute',
          borderRadius: '8px',
          border: `2px solid ${theme.primaryColor}`,
          boxShadow: `0 0 0 4px ${primaryColorRgba}`,
          pointerEvents: 'none',
          top: highlightRect.top - highlightPadding,
          left: highlightRect.left - highlightPadding,
          width: highlightRect.width + highlightPadding * 2,
          height: highlightRect.height + highlightPadding * 2,
        }}
      />
    </div>
  );
}
