import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Dark mode (src/app/theme.css) flips these through CSS variables.
        slate: Object.fromEntries(
          ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"].map((k) => [k, `rgb(var(--sl-${k}) / <alpha-value>)`])
        ),
        // Card and panel backgrounds: white in light, deep navy in dark.
        surface: "rgb(var(--surface) / <alpha-value>)",
        // Fixed dark grays for tooltips and dark panels that stay dark in both themes.
        ink: { 200: "#e2e8f0", 300: "#cbd5e1", 400: "#94a3b8", 700: "#334155", 800: "#1e293b", 900: "#0f172a", 950: "#020617" },
        // Primary brand ramp — the same blue the AlgeBridge marketing site
        // (algebridge.org) uses, so the course platform and the public site
        // read as one product.
        bridge: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
          950: "#172554",
        },
        // Neutral support ramp for quiet surfaces and dividers.
        span: {
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        panel: "0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)",
        raised: "0 4px 12px -2px rgb(15 23 42 / 0.10), 0 2px 4px -2px rgb(15 23 42 / 0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
