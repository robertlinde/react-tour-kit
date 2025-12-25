import {type ReactNode, useMemo} from 'react';
import type {ViewStyle} from 'react-native';
import {type TourOverlayProps} from '../../shared';

const {View, StyleSheet, TouchableWithoutFeedback} = require('react-native') as typeof import('react-native');

const highlightPadding = 8;
const highlightBorderRadius = 8;

/**
 * Default overlay component for React Native.
 * Creates a semi-transparent overlay with a cutout for the highlighted element.
 */
export function TourOverlay({highlightRect, onClose, theme}: TourOverlayProps): ReactNode {
  const cutoutTop = highlightRect.top - highlightPadding;
  const cutoutLeft = highlightRect.left - highlightPadding;
  const cutoutWidth = highlightRect.width + highlightPadding * 2;
  const cutoutHeight = highlightRect.height + highlightPadding * 2;

  const themedStyles = useMemo(
    (): {overlay: ViewStyle; highlightBorder: ViewStyle} => ({
      overlay: {
        backgroundColor: theme.overlayColor,
      },
      highlightBorder: {
        borderColor: theme.primaryColor,
      },
    }),
    [theme],
  );

  return (
    <TouchableWithoutFeedback onPress={onClose}>
      <View style={styles.container}>
        {/* Top overlay */}
        <View
          style={[
            styles.overlay,
            themedStyles.overlay,
            {
              top: 0,
              left: 0,
              right: 0,
              height: cutoutTop,
            },
          ]}
        />

        {/* Left overlay */}
        <View
          style={[
            styles.overlay,
            themedStyles.overlay,
            {
              top: cutoutTop,
              left: 0,
              width: cutoutLeft,
              height: cutoutHeight,
            },
          ]}
        />

        {/* Right overlay */}
        <View
          style={[
            styles.overlay,
            themedStyles.overlay,
            {
              top: cutoutTop,
              left: cutoutLeft + cutoutWidth,
              right: 0,
              height: cutoutHeight,
            },
          ]}
        />

        {/* Bottom overlay */}
        <View
          style={[
            styles.overlay,
            themedStyles.overlay,
            {
              top: cutoutTop + cutoutHeight,
              left: 0,
              right: 0,
              bottom: 0,
            },
          ]}
        />

        {/* Highlight border */}
        <View
          style={[
            styles.highlightBorder,
            themedStyles.highlightBorder,
            {
              top: cutoutTop,
              left: cutoutLeft,
              width: cutoutWidth,
              height: cutoutHeight,
              borderRadius: highlightBorderRadius,
            },
          ]}
        />
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
  },
  overlay: {
    position: 'absolute',
  },
  highlightBorder: {
    position: 'absolute',
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
});
