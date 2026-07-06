import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Monochrome brand ramp — matches the AlgeBridge logo (black on white).
        bridge: {
          50: "#f7f7f7",
          100: "#eeeeee",
          200: "#dddddd",
          300: "#bbbbbb",
          400: "#888888",
          500: "#555555",
          600: "#2a2a2a",
          700: "#1a1a1a",
          800: "#101010",
          900: "#050505",
          950: "#000000",
        },
        // Secondary accent — same monochrome family, used for small highlights/badges.
        span: {
          50: "#f7f7f7",
          100: "#eeeeee",
          200: "#dddddd",
          300: "#bbbbbb",
          400: "#888888",
          500: "#000000",
          600: "#000000",
          700: "#000000",
          800: "#000000",
          900: "#000000",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
