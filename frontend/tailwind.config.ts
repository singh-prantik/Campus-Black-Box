import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        border: "var(--border)",
        text: "var(--text)",
        muted: "var(--muted)",
        accent: "var(--accent)",
        "accent-hover": "var(--accent-hover)",
        // Compatibility aliases with existing components
        background: "var(--bg)",
        "text-primary": "var(--text)",
        "text-secondary": "var(--muted)",
        primary: "var(--accent)",
        "primary-hover": "var(--accent-hover)",
      },
      borderRadius: {
        card: "12px",
        input: "10px",
        chip: "9999px",
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
