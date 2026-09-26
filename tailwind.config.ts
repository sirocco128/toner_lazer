import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    screens: {
      xs: "390px",
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
    },
    extend: {
      colors: {
        forest: {
          DEFAULT: "rgb(var(--color-forest-rgb) / <alpha-value>)",
          light: "rgb(var(--color-forest-light-rgb) / <alpha-value>)",
          mist: "rgb(var(--color-forest-mist-rgb) / <alpha-value>)",
        },
        brass: {
          DEFAULT: "rgb(var(--color-brass-rgb) / <alpha-value>)",
          soft: "rgb(var(--color-brass-soft-rgb) / <alpha-value>)",
        },
        ink: "rgb(var(--color-ink-rgb) / <alpha-value>)",
        paper: "rgb(var(--color-paper-rgb) / <alpha-value>)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: "var(--card)",
        muted: "var(--muted)",
        border: "var(--border)",
        ring: "var(--ring)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-sarabun)",
          "var(--font-geist)",
          "var(--font-noto-sans-thai)",
          '"Sarabun"',
          '"Noto Sans Thai"',
          '"Leelawadee UI"',
          "Tahoma",
          "system-ui",
          "sans-serif",
        ],
        display: [
          "var(--font-geist)",
          "var(--font-sarabun)",
          "var(--font-noto-sans-thai)",
          "system-ui",
          "sans-serif",
        ],
      },
      fontSize: {
        "fluid-sm": ["clamp(0.8125rem, 0.76rem + 0.22vw, 0.9375rem)", { lineHeight: "1.6" }],
        "fluid-base": ["clamp(0.9375rem, 0.88rem + 0.28vw, 1.0625rem)", { lineHeight: "1.65" }],
        "fluid-lg": ["clamp(1.125rem, 0.98rem + 0.7vw, 1.5rem)", { lineHeight: "1.3" }],
        "fluid-xl": ["clamp(1.5rem, 1.15rem + 1.6vw, 2.5rem)", { lineHeight: "1.15" }],
        "fluid-2xl": ["clamp(1.875rem, 1.2rem + 2.4vw, 3.25rem)", { lineHeight: "1.08" }],
      },
      maxWidth: {
        content: "72rem",
        prose: "42rem",
      },
      minHeight: {
        touch: "2.75rem",
      },
      borderRadius: {
        lg: "0.9rem",
        md: "0.65rem",
        sm: "0.45rem",
      },
      boxShadow: {
        glass: "0 10px 40px rgb(var(--color-forest-rgb) / 0.08)",
        lift: "0 18px 50px rgb(var(--color-forest-rgb) / 0.12)",
      },
      transitionTimingFunction: {
        cinematic: "cubic-bezier(0.22, 1, 0.36, 1)",
        snappy: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.55s cubic-bezier(0.22, 1, 0.36, 1) both",
      },
    },
  },
  plugins: [],
};

export default config;
