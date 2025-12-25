'use client';

import {type JSX, type ForwardedRef, forwardRef} from 'react';
import {type TourTooltipProps} from '../../shared';

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
  }: TourTooltipProps,
  ref: ForwardedRef<HTMLDivElement>,
): JSX.Element {
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
      gap: '6px',
    },
    dot: {
      width: '8px',
      height: '8px',
      borderRadius: '50%',
      border: 'none',
      cursor: 'pointer',
      padding: 0,
    },
    dotActive: {
      backgroundColor: theme.primaryColor,
    },
    dotInactive: {
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
            {currentStep + 1} / {totalSteps}
          </span>
          <button type="button" style={styles.closeButton} aria-label="Close tour" onClick={onClose}>
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
            ← Back
          </button>

          <div style={styles.dotsContainer}>
            {Array.from({length: totalSteps}).map((_, index) => (
              <button
                key={`step-${index}`}
                type="button"
                style={{
                  ...styles.dot,
                  ...(index === currentStep ? styles.dotActive : styles.dotInactive),
                }}
                aria-label={`Go to step ${index + 1}`}
                onClick={() => {
                  onGoToStep(index);
                }}
              />
            ))}
          </div>

          <button type="button" style={styles.nextButton} onClick={onNext}>
            {isLastStep ? 'Finish' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  );
}

export const TourTooltip = forwardRef(TourTooltipComponent);
