/** Plugin ESLint local do Unify (regras de acessibilidade especificas do app). */
module.exports = {
  rules: {
    "interactive-accessibility-hint": require("./interactive-accessibility-hint"),
  },
};
