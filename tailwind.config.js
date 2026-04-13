/** @type {import('tailwindcss').Config} */
module.exports = {
<<<<<<< Updated upstream
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
=======
  // O segredo está nestas linhas abaixo:
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  presets: [require("nativewind/preset")],
>>>>>>> Stashed changes
  theme: {
    extend: {},
  },
  plugins: [],
<<<<<<< Updated upstream
}
=======
}
>>>>>>> Stashed changes
