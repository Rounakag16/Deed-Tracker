/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Dark "data-flow" theme, grounded in the land-deed-ledger subject
        // matter rather than a generic dark-dashboard look. See
        // PROJECT_CONTEXT.md's Important Decisions for the reasoning.
        canvas: "#12151a", // page/canvas background - deep ink-charcoal, not pure black
        surface: {
          DEFAULT: "#1b2027", // cards, panels, toolbar
          raised: "#20262e", // hover/raised state
        },
        border: {
          DEFAULT: "#2b323c",
          strong: "#3a4350",
        },
        ink: {
          DEFAULT: "#e9e6dc", // primary text - warm off-white, not pure white
          muted: "#8d94a3",
          faint: "#5c6373",
        },
        brass: {
          DEFAULT: "#c98a3b", // connector wires, primary actions - deed-seal/ink-stamp tone
          soft: "#a9723a",
        },
        verdigris: "#4f9a8c", // selection state - deliberately distinct from brass
        brick: "#b2543f", // destructive actions
      },
      fontFamily: {
        serif: ["Fraunces", "ui-serif", "Georgia", "serif"],
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
