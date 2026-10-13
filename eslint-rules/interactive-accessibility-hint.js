/**
 * Regra local: `accessibilityHint` obrigatorio SO em elemento interativo.
 *
 * Substitui `react-native-a11y/has-accessibility-hint`, que exige hint em
 * QUALQUER elemento com `accessibilityLabel` — inclusive textos, imagens e
 * grupos estaticos (ex.: `<View accessibilityRole="text" accessibilityLabel=...>`),
 * onde a dica nao tem o que descrever e so alonga a leitura do TalkBack.
 * Pelas diretrizes da Apple/Android, a dica descreve o RESULTADO de uma acao;
 * por isso aqui ela e exigida quando o elemento:
 *
 * - e um componente tocavel/editavel (Pressable, Touchable*, Switch, TextInput...);
 * - recebe `onPress`/`onLongPress`; ou
 * - declara um papel interativo (`button`, `link`, `switch`, `tab`...).
 *
 * `accessibilityHint` vazio ou so com espacos conta como ausente.
 */
const INTERACTIVE_COMPONENTS = new Set([
  "Pressable",
  "TouchableOpacity",
  "TouchableHighlight",
  "TouchableWithoutFeedback",
  "TouchableNativeFeedback",
  "Button",
  "Switch",
  "TextInput",
]);

const INTERACTIVE_ROLES = new Set([
  "button",
  "link",
  "switch",
  "checkbox",
  "radio",
  "tab",
  "imagebutton",
  "adjustable",
  "menuitem",
  "togglebutton",
  "combobox",
  "search",
  "spinbutton",
]);

const ACTION_PROPS = ["onPress", "onLongPress"];

function getProp(attributes, name) {
  return attributes.find(
    (attribute) =>
      attribute.type === "JSXAttribute" &&
      attribute.name &&
      attribute.name.name === name
  );
}

function getStaticString(attribute) {
  if (!attribute || !attribute.value) {
    return null;
  }

  if (attribute.value.type === "Literal") {
    return typeof attribute.value.value === "string" ? attribute.value.value : null;
  }

  if (
    attribute.value.type === "JSXExpressionContainer" &&
    attribute.value.expression.type === "Literal" &&
    typeof attribute.value.expression.value === "string"
  ) {
    return attribute.value.expression.value;
  }

  return null;
}

function getElementName(node) {
  if (node.name.type === "JSXIdentifier") {
    return node.name.name;
  }

  if (node.name.type === "JSXMemberExpression") {
    return node.name.property.name;
  }

  return null;
}

module.exports = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Exige accessibilityHint em elementos interativos que tem accessibilityLabel",
    },
    schema: [],
    messages: {
      missingHint:
        "Elemento interativo com accessibilityLabel precisa de accessibilityHint descrevendo o resultado da ação.",
    },
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        const attributes = node.attributes;
        const hasSpread = attributes.some((attribute) => attribute.type === "JSXSpreadAttribute");

        if (!getProp(attributes, "accessibilityLabel")) {
          return;
        }

        const hint = getProp(attributes, "accessibilityHint");
        const staticHint = getStaticString(hint);

        if (hint && (staticHint === null || staticHint.trim().length > 0)) {
          return;
        }

        // Espalhar props (`{...rest}`) pode trazer a dica: nao da para afirmar.
        if (!hint && hasSpread) {
          return;
        }

        const elementName = getElementName(node);
        const role = getStaticString(getProp(attributes, "accessibilityRole"));
        const interactive =
          INTERACTIVE_COMPONENTS.has(elementName) ||
          ACTION_PROPS.some((name) => Boolean(getProp(attributes, name))) ||
          (role !== null && INTERACTIVE_ROLES.has(role));

        if (interactive) {
          context.report({ node, messageId: "missingHint" });
        }
      },
    };
  },
};
