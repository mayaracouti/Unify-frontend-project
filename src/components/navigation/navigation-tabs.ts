import type { ComponentProps } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";

export type NavigationTab = {
  badgeKey?: "matches";
  icon: ComponentProps<typeof Ionicons>["name"];
  iconActive?: ComponentProps<typeof Ionicons>["name"];
  label: string;
  route: string;
};

export const navigationTabs: NavigationTab[] = [
  { label: "Início", icon: "home-outline", iconActive: "home", route: "/home" },
  { label: "Explorar", icon: "search-outline", iconActive: "search", route: "/explore" },
  {
    label: "Encontros",
    icon: "heart-outline",
    iconActive: "heart",
    route: "/matches",
    badgeKey: "matches",
  },
  { label: "Comunidades", icon: "people-outline", iconActive: "people", route: "/community" },
  { label: "Perfil", icon: "person-outline", iconActive: "person", route: "/profile" },
];