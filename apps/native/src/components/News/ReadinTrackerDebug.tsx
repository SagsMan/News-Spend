import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

const __DEV_TRACKER__ = __DEV__;

type Props = {
  elapsedSeconds: number;
  minReadingSeconds: number;
  hasScrolledThreshold: boolean;
  inRapidScroll: boolean;
  isTracking: boolean;
  wordCount?: number;
};

type RowProps = {
  label: string;
  value: string;
  valueColor?: string;
};

const Row = ({ label, value, valueColor = "#e2e2e2" }: RowProps) => (
  <View className="flex-row justify-between gap-3">
    <Text className="text-[11px]" style={{ color: "#888" }}>
      {label}
    </Text>
    <Text className="font-semibold text-[11px]" style={{ color: valueColor }}>
      {value}
    </Text>
  </View>
);

export function ReadingTrackerDebug({
  elapsedSeconds,
  minReadingSeconds,
  hasScrolledThreshold,
  inRapidScroll,
  isTracking,
  wordCount,
}: Props) {
  const [visible, setVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start();
  }, [visible, slideAnim]);

  useEffect(() => {
    if (!isTracking) {
      pulseAnim.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isTracking, pulseAnim.setValue, pulseAnim]);

  if (!__DEV_TRACKER__) {
    return null;
  }

  const progress = Math.min(elapsedSeconds / minReadingSeconds, 1);
  const progressPct = `${Math.round(progress * 100)}%`;
  const remaining = Math.max(minReadingSeconds - elapsedSeconds, 0);
  const statusColor = inRapidScroll
    ? "#f87171"
    : isTracking
      ? "#4ade80"
      : "#facc15";

  const _panelTranslateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [200, 0],
  });

  return (
    <>
      <Pressable
        onPress={() => setVisible((v) => !v)}
        style={styles.toggleButton}
      >
        <Animated.View
          style={[
            styles.dot,
            { backgroundColor: statusColor, opacity: pulseAnim },
          ]}
        />
        <Text className="ml-1.5 text-[10px]" style={{ color: "#e2e2e2" }}>
          {visible ? "HIDE" : "DBG"}
        </Text>
      </Pressable>

      {visible ? (
        <Animated.View pointerEvents="none" style={[styles.panel]}>
          <View className="gap-1.5">
            <View
              className="mb-1 h-1 w-full flex-row overflow-hidden rounded-[3px]"
              style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
            >
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    width: progressPct,
                    backgroundColor: inRapidScroll ? "#f87171" : "#4ade80",
                  },
                ]}
              />
            </View>

            <Row label="elapsed" value={`${elapsedSeconds}s`} />
            <Row label="required" value={`${minReadingSeconds}s`} />
            <Row label="remaining" value={`${remaining}s`} />
            <Row label="progress" value={progressPct} />
            {wordCount !== undefined && (
              <Row label="word count" value={String(wordCount)} />
            )}

            <View
              className="my-1 h-px w-full flex-row"
              style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
            />

            <Row
              label="scroll ≥85%"
              value={hasScrolledThreshold ? "✓ yes" : "✗ no"}
              valueColor={hasScrolledThreshold ? "#4ade80" : "#f87171"}
            />
            <Row
              label="rapid scroll"
              value={inRapidScroll ? "⚠ yes" : "✓ no"}
              valueColor={inRapidScroll ? "#f87171" : "#4ade80"}
            />
            <Row
              label="tracking"
              value={isTracking ? "● active" : "○ paused"}
              valueColor={isTracking ? "#4ade80" : "#facc15"}
            />
          </View>
        </Animated.View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  toggleButton: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.75)",
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 6,
    borderWidth: 1,
    bottom: 90,
    flexDirection: "row",
    paddingHorizontal: 10,
    paddingVertical: 6,
    position: "absolute",
    right: 12,
    zIndex: 9999,
  },
  dot: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  panel: {
    backgroundColor: "rgba(10,10,10,0.88)",
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    position: "absolute",
    left: 12,
    bottom: 0,
    width: 210,
    zIndex: 9998,
  },
  progressFill: {
    borderRadius: 3,
    height: "100%",
  },
});
