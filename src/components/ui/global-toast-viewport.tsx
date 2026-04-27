import { useCallback, useEffect, useRef, useState } from "react";
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  Animated,
  Pressable,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  subscribeToGlobalToasts,
  type GlobalToast,
  type GlobalToastVariant,
} from "../../utils/globalToast";

const shadowStyle: ViewStyle = {
  elevation: 10,
  shadowColor: "#020617",
  shadowOffset: { width: 0, height: 12 },
  shadowOpacity: 0.26,
  shadowRadius: 24,
};

const errorStyle: ViewStyle = {
  backgroundColor: "#FB7185",
  borderColor: "#FB7185",
  borderWidth: 1,
  elevation: 10,
  shadowColor: "#FB7185",
  shadowOffset: { width: 0, height: 12 },
  // shadowOpacity: 0.26,
  // shadowRadius: 24,
};

const infoStyle: ViewStyle = {
  backgroundColor: "#38BDF8",
  borderColor: "#38BDF8",
  borderWidth: 1,
  elevation: 10,
  shadowColor: "#38BDF8",
  shadowOffset: { width: 0, height: 12 },
  // shadowOpacity: 0.26,
  // shadowRadius: 24,
};

const successStyle: ViewStyle = {
  backgroundColor: "#34D399",
  borderColor: "#34D399",
  borderWidth: 1,
  elevation: 10,
  shadowColor: "#34D399",
  shadowOffset: { width: 0, height: 12 },
  // shadowOpacity: 0.26,
  // shadowRadius: 24,
};

const waringStyle: ViewStyle = {
  backgroundColor: "#FBBF24",
  borderColor: "#FBBF24",
  borderWidth: 1,
  elevation: 10,
  shadowColor: "#FBBF24",
}

function getAccentColor(variant: GlobalToastVariant): string {
  switch (variant) {
    case "error":
      return "#FB7185";
    case "success":
      return "#34D399";
    default:
      return "#38BDF8";
  }
}

function GlobalToastCard({
  toast,
  onDismiss,
}: {
  toast: GlobalToast;
  onDismiss: (toastId: string) => void;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-18)).current;

  const dismissToast = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 170,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -14,
        duration: 170,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss(toast.id);
    });
  }, [onDismiss, opacity, toast.id, translateY]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();

    const timeout = setTimeout(() => {
      dismissToast();
    }, toast.durationMs);

    return () => {
      clearTimeout(timeout);
    };
  }, [dismissToast, opacity, toast.durationMs, translateY]);

  return (
    <Animated.View
      style={{
        opacity,
        transform: [{ translateY }],
      }}
    >
      <View
        className="mb-3 overflow-hidden rounded-[24px] border"
        style={[toast.variant === "error" ? errorStyle : 
              toast.variant === "success" ? successStyle : 
              toast.variant === "warning" ? waringStyle :
              infoStyle]}
      >
        <View className="flex-row items-start px-4 py-3.5">
          <View className="mr-3">
            {
              (() => {
                switch (toast.variant) {
                    case "error":
                      return <Ionicons name="close-circle-outline" size={18} color={'white'}/>;
                    case "success":
                      return <Ionicons name="checkmark-circle-outline" size={18} color={'white'}/>;
                    case "warning":
                      return <Ionicons name="warning-outline" size={18} color={'white'}/>;
                    default:
                      return <Ionicons name="information-outline" size={18} color={'white'}/>;
                }
            })()}
          </View>

          <View className="flex-1">
            <Text className="text-[14px] font-bold uppercase tracking-[1px] text-white">
              {toast.title}
            </Text>
            <Text className="mt-1 text-[13px] leading-5 text-white">
              {toast.message}
            </Text>
          </View>

          <Pressable
            className="ml-3 rounded-full px-2 py-1"
            onPress={dismissToast}
            style={({ pressed }) => (pressed ? { opacity: 0.72 } : null)}
          >
            <Ionicons name="close" size={20} color={'white'} />
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

export function GlobalToastViewport() {
  const [toasts, setToasts] = useState<GlobalToast[]>([]);

  useEffect(() => {
    return subscribeToGlobalToasts((toast) => {
      setToasts((currentToasts) => [...currentToasts, toast].slice(-3));
    });
  }, []);

  const handleDismiss = useCallback((toastId: string) => {
    setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== toastId));
  }, []);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <View pointerEvents="box-none" className="absolute left-0 right-0 top-0 z-50">
      <SafeAreaView edges={["top"]} pointerEvents="box-none">
        <View pointerEvents="box-none" className="px-4 pt-3 gap-2">
          {toasts.map((toast) => (
            <GlobalToastCard key={toast.id} toast={toast} onDismiss={handleDismiss} />
          ))}
        </View>
      </SafeAreaView>
    </View>
  );
}