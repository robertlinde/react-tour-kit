import {type JSX, useCallback, useState, useEffect, useRef, useMemo} from 'react';
import type {View as ViewType} from 'react-native';
import {
  type TourStep,
  type TourContextType,
  type Rect,
  type StartTourOptions,
  type TourEndCallback,
  type TourEndInfo,
  type TourEndReason,
  TourContext,
  calculateTooltipPosition,
  resolveTheme,
} from '../shared/index.js';
import {TourTooltip as DefaultTourTooltip} from './components/tour-tooltip';
import {TourOverlay as DefaultTourOverlay} from './components/tour-overlay';
import {nativePlatformAdapter} from './platform-adapter';
import {TourProviderProps} from './types/tour-provider.props.type';

const {Modal} = require('react-native') as typeof import('react-native');

const defaultPlacement = 'bottom' as const;
const positionRetryDelayMs = 100;
const initialPositionDelayMs = 50;
const maxPositionAttempts = 20;
const domUpdateDelayMs = 100;

export function TourProvider({
  children,
  TooltipComponent,
  OverlayComponent,
  onTourEnd,
  theme,
  platform = nativePlatformAdapter,
  i18n,
  closeOnOverlayClick = true,
}: TourProviderProps): JSX.Element {
  const resolvedTheme = useMemo(() => resolveTheme(theme), [theme]);
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState<TourStep[]>([]);
  const [currentTourId, setCurrentTourId] = useState<string | undefined>(undefined);
  const [tooltipPosition, setTooltipPosition] = useState({top: 0, left: 0});
  const [isPositioned, setIsPositioned] = useState(false);
  const [highlightRect, setHighlightRect] = useState<Rect | undefined>(undefined);
  const [tooltipSize, setTooltipSize] = useState({width: 0, height: 0});
  const tooltipRef = useRef<ViewType>(null);
  const [positionKey, setPositionKey] = useState(0);
  const tourOnEndRef = useRef<TourEndCallback | undefined>(undefined);

  const Tooltip = TooltipComponent ?? DefaultTourTooltip;
  const Overlay = OverlayComponent ?? DefaultTourOverlay;

  const startTour = useCallback((tourSteps: TourStep[], tourId?: string, options?: StartTourOptions): void => {
    if (tourSteps.length > 0) {
      setSteps(tourSteps);
      setCurrentStep(0);
      setCurrentTourId(tourId);
      tourOnEndRef.current = options?.onTourEnd;
      setIsActive(true);
    }
  }, []);

  const finishTour = useCallback(
    (reason: TourEndReason): void => {
      // Snapshot step info BEFORE resetting state so callbacks see accurate values.
      const stepAtEnd = steps[currentStep] ?? steps.at(-1);

      if (stepAtEnd) {
        const info: TourEndInfo = {
          reason,
          stepIndex: currentStep,
          step: stepAtEnd,
          totalSteps: steps.length,
        };

        // Tour-level fires first, provider-level second.
        tourOnEndRef.current?.(currentTourId, info);
        onTourEnd?.(currentTourId, info);
      }

      tourOnEndRef.current = undefined;
      setIsActive(false);
      setCurrentStep(0);
      setSteps([]);
      setCurrentTourId(undefined);
      setHighlightRect(undefined);
      setTooltipPosition({top: 0, left: 0});
      setTooltipSize({width: 0, height: 0});
      setIsPositioned(false);
    },
    [currentTourId, currentStep, steps, onTourEnd],
  );

  const handleTooltipMeasured = useCallback((size: {width: number; height: number}): void => {
    setTooltipSize((previous) => {
      if (previous.width === size.width && previous.height === size.height) {
        return previous;
      }

      return size;
    });
  }, []);

  // Context-exposed endTour stays compatible with existing consumers.
  // Defaults to 'closed' since a direct `useTour().endTour()` call is
  // semantically equivalent to the user dismissing the tour.
  const endTour = useCallback((): void => {
    finishTour('closed');
  }, [finishTour]);

  const nextStep = useCallback((): void => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((previous) => previous + 1);
    } else {
      finishTour('completed');
    }
  }, [currentStep, steps.length, finishTour]);

  const previousStep = useCallback((): void => {
    if (currentStep > 0) {
      setCurrentStep((previous) => previous - 1);
    }
  }, [currentStep]);

  const goToStep = useCallback(
    (step: number): void => {
      if (step >= 0 && step < steps.length) {
        setCurrentStep(step);
      }
    },
    [steps.length],
  );

  const updatePositions = useCallback((): void => {
    if (!isActive || steps.length === 0) {
      return;
    }

    const currentTourStep = steps[currentStep];
    if (!currentTourStep) {
      return;
    }

    void (async (): Promise<void> => {
      const rect = await platform.measureElement(currentTourStep.target);
      if (!rect) {
        if (currentStep < steps.length - 1) {
          setCurrentStep((previous) => previous + 1);
        } else {
          finishTour('target-missing');
        }

        return;
      }

      setHighlightRect(rect);

      const placement = currentTourStep.placement ?? defaultPlacement;
      const viewportDimensions = platform.getViewportDimensions();
      const position = calculateTooltipPosition(rect, placement, tooltipSize, viewportDimensions);
      setTooltipPosition(position);
      setIsPositioned(true);
    })();
  }, [isActive, currentStep, steps, finishTour, platform, tooltipSize]);

  // Handle step transitions and onBeforeStep callbacks
  useEffect(() => {
    if (!isActive || steps.length === 0) {
      return;
    }

    const currentTourStep = steps[currentStep];
    if (!currentTourStep) {
      return;
    }

    const runStep = async (): Promise<void> => {
      if (currentTourStep.onBeforeStep) {
        await currentTourStep.onBeforeStep();
        await new Promise<void>((resolve) => {
          setTimeout(resolve, domUpdateDelayMs);
        });
      }

      const rect = await platform.measureElement(currentTourStep.target);
      if (!rect) {
        if (currentStep < steps.length - 1) {
          setCurrentStep((previous) => previous + 1);
        } else {
          finishTour('target-missing');
        }

        return;
      }

      setHighlightRect(rect);
      // Intentionally do not reset isPositioned or tooltipSize here. Keeping
      // the previous step's measurement lets the next step's tooltip move
      // directly to its new position instead of flashing invisible while we
      // wait for onLayout to refire. onLayout will update tooltipSize on the
      // next frame if the new content has a different height; the position
      // effect then re-runs with the latest size. Only the very first step of
      // a tour starts with isPositioned=false (from useState), preserving the
      // opacity-0 first-render behavior that prevents the initial jump.

      // Trigger positioning - scrolling happens after tooltip is measured
      setTimeout(() => {
        setPositionKey((k) => k + 1);
      }, initialPositionDelayMs);
    };

    void runStep();
  }, [isActive, currentStep, steps, finishTour, platform]);

  // Calculate tooltip position with retry logic
  useEffect(() => {
    if (!isActive || !highlightRect || steps.length === 0) {
      return;
    }

    const currentTourStep = steps[currentStep];
    if (!currentTourStep) {
      return;
    }

    let attempts = 0;
    let timeoutId: ReturnType<typeof setTimeout>;
    let animationFrameId: number;

    const tryPosition = (): void => {
      attempts++;

      animationFrameId = platform.scheduleFrame(() => {
        void (async (): Promise<void> => {
          const rect = await platform.measureElement(currentTourStep.target);

          if (!rect || rect.width === 0 || rect.height === 0) {
            if (attempts < maxPositionAttempts) {
              timeoutId = setTimeout(tryPosition, positionRetryDelayMs);
            }

            return;
          }

          setHighlightRect(rect);

          const placement = currentTourStep.placement ?? defaultPlacement;
          const viewportDimensions = platform.getViewportDimensions();
          const position = calculateTooltipPosition(rect, placement, tooltipSize, viewportDimensions);

          setTooltipPosition(position);
          // Only reveal the tooltip once we have its real measured size. Showing it
          // earlier flashes it at a position computed from the default-height fallback,
          // then visibly jumps when onLayout reports the real dimensions.
          if (tooltipSize.height > 0 && tooltipSize.width > 0) {
            setIsPositioned(true);
          }

          // Scroll after positioning so we have actual tooltip dimensions
          await platform.scrollToElement(currentTourStep.target, placement, tooltipSize.height);
        })();
      });
    };

    timeoutId = setTimeout(tryPosition, initialPositionDelayMs);

    return (): void => {
      clearTimeout(timeoutId);
      if (animationFrameId) {
        platform.cancelFrame(animationFrameId);
      }
    };
  }, [isActive, currentStep, steps, highlightRect, positionKey, platform, tooltipSize]);

  // Keyboard/back button navigation
  useEffect(() => {
    if (!isActive) {
      return;
    }

    return platform.subscribeToKeyboard({
      // On React Native this fires from the Android hardware back button,
      // which is semantically equivalent to the user closing the tour.
      onEscape() {
        finishTour('closed');
      },
      onNext: nextStep,
      onPrev: previousStep,
    });
  }, [isActive, finishTour, nextStep, previousStep, platform]);

  // Handle layout changes
  useEffect(() => {
    if (!isActive) {
      return;
    }

    return platform.subscribeToLayout(updatePositions);
  }, [isActive, updatePositions, platform]);

  const currentTourStep = steps[currentStep];

  const contextValue = useMemo<TourContextType>(
    () => ({
      isActive,
      currentStep,
      steps,
      currentTourId,
      startTour,
      endTour,
      nextStep,
      prevStep: previousStep,
      goToStep,
    }),
    [isActive, currentStep, steps, currentTourId, startTour, endTour, nextStep, previousStep, goToStep],
  );

  return (
    <TourContext value={contextValue}>
      {children}

      <Modal transparent visible={Boolean(isActive && highlightRect)} animationType="fade">
        {highlightRect ? (
          <>
            <Overlay
              closeOnOverlayClick={closeOnOverlayClick}
              highlightRect={highlightRect}
              theme={resolvedTheme}
              onClose={() => {
                finishTour('blur');
              }}
            />

            {currentTourStep ? (
              <Tooltip
                ref={tooltipRef}
                content={currentTourStep.content}
                currentStep={currentStep}
                i18n={i18n}
                isPositioned={isPositioned}
                position={tooltipPosition}
                theme={resolvedTheme}
                title={currentTourStep.title}
                totalSteps={steps.length}
                onClose={endTour}
                onGoToStep={goToStep}
                onMeasured={handleTooltipMeasured}
                onNext={nextStep}
                onPrev={previousStep}
              />
            ) : null}
          </>
        ) : null}
      </Modal>
    </TourContext>
  );
}
