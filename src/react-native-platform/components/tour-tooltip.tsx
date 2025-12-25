import {type ReactNode, forwardRef, type ForwardedRef, useMemo} from 'react';
import type {View as ViewType, ViewStyle, TextStyle} from 'react-native';
import {type TourTooltipProps} from '../../shared';

const {View, Text, TouchableOpacity, StyleSheet} = require('react-native') as typeof import('react-native');

/**
 * Default tooltip component for React Native.
 * Displays tour step content with navigation controls.
 */
// eslint-disable-next-line func-names -- forwardRef requires named function for display name
export const TourTooltip = forwardRef(function TourTooltip(
  {title, content, currentStep, totalSteps, position, isPositioned, onClose, onNext, onPrev, theme}: TourTooltipProps,
  ref: ForwardedRef<ViewType>,
): ReactNode {
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;

  const themedStyles = useMemo(
    (): {
      container: ViewStyle;
      stepBadge: ViewStyle;
      closeButtonText: TextStyle;
      title: TextStyle;
      content: TextStyle;
      nextButton: ViewStyle;
      dotActive: ViewStyle;
    } => ({
      container: {
        backgroundColor: theme.tooltipBackground,
      },
      stepBadge: {
        backgroundColor: theme.primaryColor,
      },
      closeButtonText: {
        color: theme.contentColor,
      },
      title: {
        color: theme.titleColor,
      },
      content: {
        color: theme.contentColor,
      },
      nextButton: {
        backgroundColor: theme.primaryColor,
      },
      dotActive: {
        backgroundColor: theme.primaryColor,
      },
    }),
    [theme],
  );

  return (
    <View
      ref={ref}
      style={[
        styles.container,
        themedStyles.container,
        {
          top: position.top,
          left: position.left,
          opacity: isPositioned ? 1 : 0,
        },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.stepBadge, themedStyles.stepBadge]}>
          <Text style={styles.stepBadgeText}>
            Step {currentStep + 1} of {totalSteps}
          </Text>
        </View>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={[styles.closeButtonText, themedStyles.closeButtonText]}>×</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.body}>
        <Text style={[styles.title, themedStyles.title]}>{title}</Text>
        <Text style={[styles.content, themedStyles.content]}>{content}</Text>
      </View>

      {/* Navigation */}
      <View style={styles.footer}>
        <TouchableOpacity
          disabled={isFirstStep}
          style={[styles.navButton, styles.prevButton, isFirstStep && styles.buttonDisabled]}
          onPress={onPrev}
        >
          <Text style={[styles.prevButtonText, isFirstStep && styles.buttonTextDisabled]}>Back</Text>
        </TouchableOpacity>

        {/* Step dots */}
        <View style={styles.dots}>
          {Array.from({length: totalSteps}).map((_, index) => (
            <View key={index} style={[styles.dot, index === currentStep && themedStyles.dotActive]} />
          ))}
        </View>

        <TouchableOpacity style={[styles.navButton, themedStyles.nextButton]} onPress={onNext}>
          <Text style={styles.nextButtonText}>{isLastStep ? 'Done' : 'Next'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: 320,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  stepBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  stepBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    fontSize: 24,
    lineHeight: 24,
  },
  body: {
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  content: {
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 8,
  },
  navButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  prevButton: {
    backgroundColor: '#f3f4f6',
  },
  prevButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  nextButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#ffffff',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonTextDisabled: {
    color: '#9ca3af',
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#d1d5db',
  },
});
