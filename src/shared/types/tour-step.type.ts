import {type TourTarget, type Placement} from './rect.type';

export type TourStep = {
  /**
   * Target element to highlight.
   * - Web: CSS selector string (e.g., '#my-button', '.welcome-card')
   * - React Native: RefObject or string ID registered via useTourTarget
   */
  target: TourTarget;
  title: string;
  content: string;
  placement?: Placement;
  /**
   * Called before this step is shown. Use to switch tabs, open dialogs, navigate, etc.
   * Receives the step's `target` so the callback can poll until the element mounts.
   */
  onBeforeStep?: (target: TourTarget) => void | Promise<void>;
};
