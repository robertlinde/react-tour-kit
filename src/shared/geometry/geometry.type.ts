/**
 * Axis-aligned box in the tour layer's coordinate space (CSS pixels on web, density-independent
 * pixels on React Native). `x`/`y` are the top-left corner.
 */
export type Box = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type Size = {
  readonly width: number;
  readonly height: number;
};

export type Point = {
  readonly x: number;
  readonly y: number;
};

export type Insets = {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
};

/**
 * The region the user can actually see, plus the parts of it that are obstructed
 * (notch, home indicator, on-screen keyboard, system bars).
 */
export type Viewport = {
  readonly rect: Box;
  readonly insets: Insets;
};

export type Side = 'top' | 'bottom' | 'left' | 'right';
