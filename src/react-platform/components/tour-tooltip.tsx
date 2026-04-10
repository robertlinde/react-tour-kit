'use client';

import {type JSX, type ForwardedRef, forwardRef} from 'react';
import {type TourTooltipProps} from '../../shared';
import {getTruncatedDots, DOTS_CONTAINER_WIDTH, DOT_SIZE, DOT_GAP} from '../../shared/utils';

const defaultI18n = {
  nextLabel: 'Next',
  prevLabel: 'Back',
  finishLabel: 'Finish',
  stepCounterTemplate: '{current} / {total}',
  closeAriaLabel: 'Close tour',
  dotAriaLabelTemplate: 'Go to step {step}',
};

function TourTooltipComponent(
  {
    title,
    content,
    currentStep,
    totalSteps,
    position,
    isPositioned,
    onClose,
    onNext,
    onPrev,
    onGoToStep,
    theme,
    i18n,
  }: TourTooltipProps,
  ref: ForwardedRef<HTMLDivElement>,
): JSX.Element {
  const {nextLabel, prevLabel, finishLabel, stepCounterTemplate, closeAriaLabel, dotAriaLabelTemplate} = {
    ...defaultI18n,
    ...i18n,
  };

  const isLastStep = currentStep === totalSteps - 1;
  const isFirstStep = currentStep === 0;

  const styles = {
    container: {
      position: 'fixed' as const,
      zIndex: 9999,
      width: '400px',
      maxWidth: 'calc(100vw - 2rem)',
    },
    card: {
      backgroundColor: theme.tooltipBackground,
      borderRadius: '8px',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      overflow: 'hidden',
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 16px 0 16px',
    },
    stepTag: {
      backgroundColor: theme.primaryColor,
      color: 'white',
      padding: '4px 8px',
      borderRadius: '4px',
      fontSize: '12px',
      fontWeight: 600,
    },
    closeButton: {
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      padding: '8px',
      borderRadius: '50%',
      color: theme.contentColor,
      fontSize: '16px',
    },
    body: {
      padding: '16px',
    },
    title: {
      margin: '0 0 8px 0',
      fontSize: '18px',
      fontWeight: 600,
      color: theme.titleColor,
    },
    content: {
      margin: 0,
      fontSize: '14px',
      color: theme.contentColor,
      lineHeight: 1.5,
    },
    footer: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px 16px 16px',
    },
    navButton: {
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      padding: '8px 16px',
      borderRadius: '4px',
      fontSize: '14px',
      color: theme.contentColor,
    },
    navButtonDisabled: {
      opacity: 0.5,
      cursor: 'not-allowed',
    },
    nextButton: {
      backgroundColor: theme.primaryColor,
      color: 'white',
      border: 'none',
      cursor: 'pointer',
      padding: '8px 16px',
      borderRadius: '4px',
      fontSize: '14px',
      fontWeight: 500,
    },
    dotsContainer: {
      display: 'flex',
      gap: `${DOT_GAP}px`,
      width: `${DOTS_CONTAINER_WIDTH}px`,
      justifyContent: 'center',
      alignItems: 'center',
    },
    dot: {
      width: `${DOT_SIZE}px`,
      height: `${DOT_SIZE}px`,
      borderRadius: '50%',
      border: 'none',
      cursor: 'pointer',
      padding: 0,
      flexShrink: 0,
    },
    dotActive: {
      backgroundColor: theme.primaryColor,
    },
    dotInactive: {
      backgroundColor: '#d1d5db',
    },
    ellipsis: {
      width: `${DOT_SIZE}px`,
      height: `${DOT_SIZE}px`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '2px',
      flexShrink: 0,
    },
    ellipsisDot: {
      width: '3px',
      height: '3px',
      borderRadius: '50%',
      backgroundColor: '#d1d5db',
    },
  };

  return (
    <div
      ref={ref}
      style={{
        ...styles.container,
        top: `${position.top}px`,
        left: `${position.left}px`,
        opacity: isPositioned ? 1 : 0,
        pointerEvents: isPositioned ? 'auto' : 'none',
      }}
    >
      <div style={styles.card}>
        <div style={styles.header}>
          <span style={styles.stepTag}>
            {stepCounterTemplate.replace('{current}', String(currentStep + 1)).replace('{total}', String(totalSteps))}
          </span>
          <button type="button" style={styles.closeButton} aria-label={closeAriaLabel} onClick={onClose}>
            ✕
          </button>
        </div>

        <div style={styles.body}>
          <h3 style={styles.title}>{title}</h3>
          <p style={styles.content}>{content}</p>
        </div>

        <div style={styles.footer}>
          <button
            type="button"
            style={{
              ...styles.navButton,
              ...(isFirstStep ? styles.navButtonDisabled : {}),
            }}
            disabled={isFirstStep}
            onClick={onPrev}
          >
            {prevLabel}
          </button>

          <div style={styles.dotsContainer}>
            {getTruncatedDots(currentStep, totalSteps).map((item, i) =>
              item.type === 'ellipsis' ? (
                <span key={`ellipsis-${i}`} style={styles.ellipsis}>
                  <span style={styles.ellipsisDot} />
                  <span style={styles.ellipsisDot} />
                </span>
              ) : (
                <button
                  key={`step-${item.index}`}
                  type="button"
                  style={{
                    ...styles.dot,
                    ...(item.index === currentStep ? styles.dotActive : styles.dotInactive),
                  }}
                  aria-label={dotAriaLabelTemplate.replace('{step}', String(item.index + 1))}
                  onClick={() => {
                    onGoToStep(item.index);
                  }}
                />
              ),
            )}
          </div>

          <button type="button" style={styles.nextButton} onClick={onNext}>
            {isLastStep ? finishLabel : nextLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export const TourTooltip = forwardRef(TourTooltipComponent);
