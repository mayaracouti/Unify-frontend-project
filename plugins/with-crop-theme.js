/**
 * Tema da tela de corte de imagem do `expo-image-picker` (Android).
 *
 * A atividade de corte (`ExpoCropImageActivity`, canhub Android-Image-Cropper)
 * resolve as cores pelos recursos `expoCrop*` de `res/values/colors.xml` e
 * `res/values-night/colors.xml` da biblioteca. Recursos do app com o MESMO
 * nome vencem os da biblioteca na mesclagem do Gradle, entao basta declarar
 * aqui — nos dois qualificadores, porque o app forca tema escuro
 * (`userInterfaceStyle: "dark"`) mas a atividade de corte pode nao enxergar
 * o `uiMode` noturno e cair no `values/` claro (icones pretos sobre barra
 * escura, "apagados").
 *
 * Complementa `patches/expo-image-picker+17.0.11.patch`, que liga o pinch/zoom
 * (`multiTouchEnabled`) na mesma tela.
 */
const {
  AndroidConfig,
  withAndroidColors,
  withAndroidColorsNight,
} = require("@expo/config-plugins");

const CROP_COLORS = {
  expoCropToolbarColor: "#090B18",
  expoCropToolbarIconColor: "#FFFFFF",
  expoCropToolbarActionTextColor: "#EAEA00",
  expoCropBackButtonIconColor: "#FFFFFF",
  expoCropBackgroundColor: "#000000",
};

function applyCropColors(colors) {
  return Object.entries(CROP_COLORS).reduce(
    (current, [name, value]) =>
      AndroidConfig.Colors.assignColorValue(current, { name, value }),
    colors
  );
}

function withCropTheme(config) {
  config = withAndroidColors(config, (androidConfig) => {
    androidConfig.modResults = applyCropColors(androidConfig.modResults);
    return androidConfig;
  });

  config = withAndroidColorsNight(config, (androidConfig) => {
    androidConfig.modResults = applyCropColors(androidConfig.modResults);
    return androidConfig;
  });

  return config;
}

module.exports = withCropTheme;
