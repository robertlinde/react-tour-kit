import {type Rect} from './rect.type';
import {type TourTheme} from './tour-theme.type';

export type TourOverlayProps = {
  readonly highlightRect: Rect;
  readonly onClose: () => void;
  readonly theme: Required<TourTheme>;
};
