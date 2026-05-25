import type { PropsWithChildren, ReactNode } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useRequireCompletedOnboarding } from "../../hooks/useRequireCompletedOnboarding";
import { GlobalBottomNav } from "./global-bottom-nav";
import { GlobalTopNav } from "./global-top-nav";

type AppTabScreenProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
  headerRight?: ReactNode;
}>;

export function AppTabScreen({
  children,
  title,
  subtitle,
  headerRight,
}: AppTabScreenProps) {
  useRequireCompletedOnboarding();

  return (
    <View className="flex-1 bg-[#1F2023]">
      <SafeAreaView className="flex-1">
        <GlobalTopNav />

        <View className="flex-1 px-6 pt-6">
          <View className="mb-6 flex-row items-start justify-between gap-4">
            <View className="flex-1">
              <Text className="text-[32px] font-extrabold text-white">{title}</Text>
              {subtitle ? (
                <Text className="mt-2 text-[15px] font-semibold leading-6 text-[#CAC3D8]">
                  {subtitle}
                </Text>
              ) : null}
            </View>

            {headerRight}
          </View>

          <View className="flex-1">{children}</View>
        </View>

        <GlobalBottomNav />
      </SafeAreaView>
    </View>
  );
}