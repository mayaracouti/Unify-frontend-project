const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const a11y = require("eslint-plugin-react-native-a11y");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", "dist-*/*", "android/*", "node_modules/*"],
  },
  {
    plugins: { "react-native-a11y": a11y },
    rules: {
      // Fase 1 (este documento): warn, para nao travar o build enquanto
      // o passivo e pago. Vira "error" ao final do plano semanal 03.
      "react-native-a11y/has-accessibility-hint": "warn",
      "react-native-a11y/has-valid-accessibility-actions": "warn",
      "react-native-a11y/has-valid-accessibility-component-type": "warn",
      "react-native-a11y/has-valid-accessibility-descriptors": "warn",
      "react-native-a11y/has-valid-accessibility-ignores-invert-colors": "warn",
      "react-native-a11y/has-valid-accessibility-role": "warn",
      "react-native-a11y/has-valid-accessibility-state": "warn",
      "react-native-a11y/has-valid-accessibility-value": "warn",
      "react-native-a11y/no-nested-touchables": "error",
    },
  },
]);
