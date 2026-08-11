export type FontScaleOption = "SMALL" | "MEDIUM" | "LARGE" | "EXTRA_LARGE";

export interface UserAccessibilitySettingsResponse {
  fontScale: FontScaleOption;
  fontScaleMultiplier: number;
  highContrast: boolean;
  screenReaderOptimized: boolean;
  reduceMotion: boolean;
}

export interface UserAccessibilitySettingsUpsertRequest {
  fontScale: FontScaleOption;
  highContrast: boolean;
  screenReaderOptimized: boolean;
  reduceMotion: boolean;
}
