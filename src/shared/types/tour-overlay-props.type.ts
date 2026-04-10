import {type Rect} from './rect.type';
import {type TourTheme} from './tour-theme.type';

export type TourOverlayProps = {
  readonly highlightRect: Rect;
  readonly onClose: () => void;
  readonly theme: Required<TourTheme>;
  /**
   * Whether clicking the overlay (outside the highlighted element) closes the tour.
   * When `false`, users must use the close (✕) button in the tooltip.
   * @default true
   */
  readonly closeOnOverlayClick?: boolean;
};
