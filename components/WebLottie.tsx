import React from 'react';
import { Platform } from 'react-native';
import RN_Lottie from 'lottie-react-native';

type AnyProps = any;

export default function WebLottie(props: AnyProps) {
  const { style, ...rest } = props;

  if (Platform.OS === 'web') {
    // Normalize style to plain object
    const baseStyle = Array.isArray(style)
      ? Object.assign({}, ...style)
      : (style || {});

    const resolveDim = (dim: any, fallback: number) => {
      if (typeof dim === 'string') {
        if (dim.endsWith('%')) return fallback;
        if (dim.endsWith('px')) return parseInt(dim, 10);
      }
      if (typeof dim === 'number') return dim;
      return fallback;
    };

    const safeWidth = resolveDim(baseStyle.width, 180);
    const safeHeight = resolveDim(baseStyle.height, 180);

    const safeStyle = {
      ...baseStyle,
      width: safeWidth,
      height: safeHeight,
      maxWidth: safeWidth,
      maxHeight: safeHeight,
      transform: baseStyle.transform || undefined,
    };

    return <RN_Lottie {...rest} style={safeStyle} />;
  }

  return <RN_Lottie {...props} />;
}
