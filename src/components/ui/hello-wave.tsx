import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Platform,
  Text,
  View,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewProps,
} from "react-native";

const webAnimatedCharacterStyle = {
  display: "inline-block",
} as unknown as TextStyle;

export type WormRiseTextProps = TextProps & {
  text: string;
  delay?: number;
  stagger?: number;
  duration?: number;
  fromX?: number;
  fromY?: number;
  lift?: number;
  startOpacity?: number;
  peakScale?: number;
  autoPlay?: boolean;
  replayKey?: string | number;
  characterStyle?: StyleProp<TextStyle>;
  segmentMode?: "character" | "word";
};

export type WormRiseWrapTextProps = ViewProps & {
  text: string;
  delay?: number;
  stagger?: number;
  duration?: number;
  fromX?: number;
  fromY?: number;
  lift?: number;
  startOpacity?: number;
  peakScale?: number;
  autoPlay?: boolean;
  replayKey?: string | number;
  segmentStyle?: StyleProp<TextStyle>;
  textClassName?: string;
  accessibilityLabel?: string;
};

const wrapContainerStyle = {
  flexDirection: "row",
  flexWrap: "wrap",
  alignItems: "flex-start",
} as const;

export function WormRiseText({
  text,
  delay = 0,
  stagger = 40,
  duration = 520,
  fromX = -12,
  fromY = 18,
  lift = 10,
  startOpacity = 0.0,
  peakScale = 1.06,
  autoPlay = true,
  replayKey,
  accessibilityLabel,
  characterStyle,
  segmentMode = "character",
  ...textProps
}: WormRiseTextProps) {
  const segments =
    segmentMode === "word"
      ? text.match(/\S+\s*|\s+/g) ?? Array.from(text)
      : Array.from(text);
  const progressValuesRef = useRef<Animated.Value[]>([]);
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const useNativeDriver = Platform.OS === "ios";

  if (progressValuesRef.current.length !== segments.length) {
    progressValuesRef.current = segments.map(
      (_, index) => progressValuesRef.current[index] ?? new Animated.Value(0)
    );
  }

  useEffect(() => {
    animationRef.current?.stop();

    progressValuesRef.current.forEach((value) => {
      value.setValue(autoPlay ? 0 : 1);
    });

    if (!autoPlay || segments.length === 0) {
      return;
    }

    const animation = Animated.parallel(
      progressValuesRef.current.map((value, index) =>
        Animated.sequence([
          Animated.delay(delay + index * stagger),
          Animated.timing(value, {
            toValue: 1,
            duration,
            easing: Easing.out(Easing.cubic),
            useNativeDriver,
          }),
        ])
      )
    );

    animationRef.current = animation;
    animation.start();

    return () => {
      animation.stop();
    };
  }, [autoPlay, delay, duration, replayKey, segments.length, stagger, text, useNativeDriver]);

  return (
    <Text {...textProps} accessibilityLabel={accessibilityLabel ?? text}>
      {segments.map((segment, index) => {
        const progress = progressValuesRef.current[index];

        return (
          <Animated.Text
            key={`${segment}-${index}`}
            style={[
              Platform.OS === "web" ? webAnimatedCharacterStyle : null,
              characterStyle,
              {
                opacity: progress.interpolate({
                  inputRange: [0, 0.2, 1],
                  outputRange: [startOpacity, 0.8, 1],
                }),
                transform: [
                  {
                    translateX: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [fromX, 0],
                    }),
                  },
                  {
                    translateY: progress.interpolate({
                      inputRange: [0, 0.45, 1],
                      outputRange: [fromY, fromY - lift, 0],
                    }),
                  },
                  {
                    scale: progress.interpolate({
                      inputRange: [0, 0.45, 1],
                      outputRange: [1, peakScale, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            {segment}
          </Animated.Text>
        );
      })}
    </Text>
  );
}

export function WormRiseWrapText({
  text,
  delay = 0,
  stagger = 70,
  duration = 420,
  fromX = -10,
  fromY = 18,
  lift = 26,
  startOpacity = 0,
  peakScale = 1.05,
  autoPlay = true,
  replayKey,
  segmentStyle,
  textClassName,
  accessibilityLabel,
  ...viewProps
}: WormRiseWrapTextProps) {
  const segments = text.match(/\S+\s*|\s+/g) ?? [text];
  const progressValuesRef = useRef<Animated.Value[]>([]);
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const useNativeDriver = Platform.OS !== "web";

  if (progressValuesRef.current.length !== segments.length) {
    progressValuesRef.current = segments.map(
      (_, index) => progressValuesRef.current[index] ?? new Animated.Value(0)
    );
  }

  useEffect(() => {
    animationRef.current?.stop();

    progressValuesRef.current.forEach((value) => {
      value.setValue(0);
    });

    if (!autoPlay || segments.length === 0) {
      return;
    }

    const animation = Animated.parallel(
      progressValuesRef.current.map((value, index) =>
        Animated.sequence([
          Animated.delay(delay + index * stagger),
          Animated.timing(value, {
            toValue: 1,
            duration,
            easing: Easing.out(Easing.cubic),
            useNativeDriver,
          }),
        ])
      )
    );

    animationRef.current = animation;
    animation.start();

    return () => {
      animation.stop();
    };
  }, [autoPlay, delay, duration, replayKey, segments.length, stagger, text, useNativeDriver]);

  return (
    <View
      {...viewProps}
      accessible
      accessibilityLabel={accessibilityLabel ?? text}
      style={[wrapContainerStyle, viewProps.style]}
    >
      {segments.map((segment, index) => {
        const progress = progressValuesRef.current[index];

        return (
          <Animated.Text
            key={`${segment}-${index}`}
            className={textClassName}
            style={[
              segmentStyle,
              {
                opacity: progress.interpolate({
                  inputRange: [0, 0.2, 1],
                  outputRange: [startOpacity, 0.82, 1],
                }),
                transform: [
                  {
                    translateX: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [fromX, 0],
                    }),
                  },
                  {
                    translateY: progress.interpolate({
                      inputRange: [0, 0.45, 1],
                      outputRange: [fromY, fromY - lift, 0],
                    }),
                  },
                  {
                    scale: progress.interpolate({
                      inputRange: [0, 0.45, 1],
                      outputRange: [1, peakScale, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            {segment}
          </Animated.Text>
        );
      })}
    </View>
  );
}
