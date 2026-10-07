/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        page: "rgb(var(--app-background-rgb) / <alpha-value>)",
        heritage: {
          red: "#B83232",
          "red-dark": "#922828",
          "red-light": "#C83B3B",
          gold: "#D69E2E",
          "gold-light": "#ECC94B",
          indigo: "#1A365D",
          "indigo-light": "#2B6CB0",
          jade: "#276749",
          "jade-light": "#319795",
          lotus: "#D53F8C",
          parchment: "rgb(var(--app-background-rgb) / <alpha-value>)",
          "parchment-dark": "#EFE9DF",
          ink: "#171923",
          silk: "#F7FAFC",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "'Be Vietnam Pro'", "Inter", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        serif: ["var(--font-serif)", "'Noto Serif'", "'Playfair Display'", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};
