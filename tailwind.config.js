/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Superficies (do mais escuro ao mais claro)
        surface: {
          DEFAULT: "#111111", // fundo principal de conteudo
          raised: "#19191C",  // cards
          sunken: "#070B1D",  // headers / barras
          muted: "#28282B",   // chips e estados neutros
          alt: "#111214",     // cards de listagem
        },
        // Marca
        brand: {
          DEFAULT: "#8752FF",
          strong: "#5328AA",
          soft: "#DCD5FF",
        },
        // Acao / destaque
        accent: {
          DEFAULT: "#F2F500",
          muted: "#BFC200",
        },
        // Texto
        content: {
          DEFAULT: "#FFFFFF",
          secondary: "#CAC3D8",
          muted: "#B9BAC4",
          // Clareado de #8D8D96 para #909099 (ver README, secao "Contraste
          // WCAG dos tokens de cor"): o valor original reprovava AA
          // (4,47:1) sobre surface-muted. #909099 atinge >=4,5:1 em todas
          // as superficies.
          faint: "#909099",
        },
        // Feedback
        danger: "#FF6B6B",
        success: "#4ADE80",
        info: "#9DDCFF",
      },
      fontSize: {
        // Escala base. A escala do usuario e aplicada em runtime
        // (ver plano-implementacao/00-DIAGNOSTICO-E-FUNDACAO.md secao 5)
        // multiplicando estes valores.
        "caption": ["12px", { lineHeight: "16px" }],
        "body": ["15px", { lineHeight: "24px" }],
        "title": ["20px", { lineHeight: "28px" }],
        "display": ["27px", { lineHeight: "32px" }],
      },
    },
  },
  plugins: [],
}
