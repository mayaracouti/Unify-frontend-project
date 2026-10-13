const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const a11y = require("eslint-plugin-react-native-a11y");
const unifyA11y = require("./eslint-rules");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", "dist-*/*", "android/*", "node_modules/*"],
  },
  {
    // Arquivos de infraestrutura Node (fora do bundle React Native)
    files: ["app.config.js", "scripts/**/*.js", "eslint-rules/**/*.js", "plugins/**/*.js"],
    languageOptions: {
      globals: { __dirname: "readonly", process: "readonly", require: "readonly", module: "readonly" },
    },
    rules: {
      "expo/no-dynamic-env-var": "off",
      "no-undef": "off",
    },
  },
  {
    plugins: { "react-native-a11y": a11y, "unify-a11y": unifyA11y },
    rules: {
      // Semana 05 (auditoria final): passivo zerado, regras de acessibilidade
      // viram "error" — um aviso novo quebra `npm run lint:a11y` no PR.
      //
      // `has-accessibility-hint` do plugin exige dica em QUALQUER elemento com
      // rotulo (inclusive texto e imagem estaticos), onde ela so alonga a
      // leitura. A regra local exige a dica apenas em elemento interativo
      // (ver eslint-rules/interactive-accessibility-hint.js).
      "react-native-a11y/has-accessibility-hint": "off",
      "unify-a11y/interactive-accessibility-hint": "error",
      "react-native-a11y/has-valid-accessibility-actions": "error",
      "react-native-a11y/has-valid-accessibility-component-type": "error",
      "react-native-a11y/has-valid-accessibility-descriptors": "error",
      "react-native-a11y/has-valid-accessibility-ignores-invert-colors": "error",
      "react-native-a11y/has-valid-accessibility-role": "error",
      "react-native-a11y/has-valid-accessibility-state": "error",
      "react-native-a11y/has-valid-accessibility-value": "error",
      "react-native-a11y/no-nested-touchables": "error",
    },
  },
]);
