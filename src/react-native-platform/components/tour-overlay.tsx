import {type ReactNode} from 'react';
import {type TourOverlayProps} from '../../shared';

const {View, StyleSheet, TouchableWithoutFeedback} = require('react-native') as typeof import('react-native');
const {default: Svg, Defs, Mask, Rect} = require('react-native-svg') as typeof import('react-native-svg');

const highlightPadding = 8;
const highlightBorderRadius = 8;

/**
 * Default overlay component for React Native.
 * Creates a semi-transparent overlay with a cutout for the highlighted element.
 */
export function TourOverlay({highlightRect, onClose, theme, closeOnOverlayClick}: TourOverlayProps): ReactNode {
  const x = highlightRect.left - highlightPadding;
  const y = highlightRect.top - highlightPadding;
  const width = highlightRect.width + highlightPadding * 2;
  const height = highlightRect.height + highlightPadding * 2;

  const overlayContent = (
    <View style={StyleSheet.absoluteFill} pointerEvents={closeOnOverlayClick ? 'auto' : 'none'}>
      {/* SVG `x`/`y` attributes are flagged @deprecated by inheritance from RN's
        ViewStyle, but they are the canonical SVG positioning API and have no
        replacement on react-native-svg's Rect. */}
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          <Mask id="tour-mask">
            {/* eslint-disable-next-line @typescript-eslint/no-deprecated */}
            <Rect x="0" y="0" width="100%" height="100%" fill="white" />
            {/* eslint-disable-next-line @typescript-eslint/no-deprecated */}
            <Rect x={x} y={y} width={width} height={height} rx={highlightBorderRadius} fill="black" />
          </Mask>
        </Defs>
        {/* eslint-disable-next-line @typescript-eslint/no-deprecated */}
        <Rect x="0" y="0" width="100%" height="100%" fill={theme.overlayColor} mask="url(#tour-mask)" />
      </Svg>

      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: y,
          left: x,
          width,
          height,
          borderRadius: highlightBorderRadius,
          borderWidth: 2,
          borderColor: theme.primaryColor,
        }}
      />
    </View>
  );

  if (closeOnOverlayClick) {
    return <TouchableWithoutFeedback onPress={onClose}>{overlayContent}</TouchableWithoutFeedback>;
  }

  return overlayContent;
}
