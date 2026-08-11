import { useAccessibility } from "../context/AccessibilityContext";

export function useAccessibleFontSize(baseSize: number): number {
  const { settings } = useAccessibility();
  return Math.round(baseSize * settings.fontScaleMultiplier);
}
