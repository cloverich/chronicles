import { fontFamily } from "tailwindcss/defaultTheme";

/** @type {import('tailwindcss').Config} */
const plugin = require("tailwindcss/plugin");

export const darkMode = ["class"];
export const content = ["src/**/*.{ts,tsx}"];
export const theme = {
  container: {
    center: true,
    padding: "2rem",
    screens: {
      "2xl": "1400px",
    },
  },
  extend: {
    colors: {
      border: "hsl(var(--border))",
      input: "hsl(var(--input))",
      ring: "hsl(var(--ring))",
      background: "hsl(var(--background))",
      foreground: "hsl(var(--foreground))",
      primary: {
        DEFAULT: "hsl(var(--primary))",
        foreground: "hsl(var(--primary-foreground))",
      },
      secondary: {
        DEFAULT: "hsl(var(--secondary))",
        foreground: "hsl(var(--secondary-foreground))",
      },
      destructive: {
        DEFAULT: "hsl(var(--destructive))",
        foreground: "hsl(var(--destructive-foreground))",
      },
      muted: {
        DEFAULT: "hsl(var(--muted))",
        foreground: "hsl(var(--muted-foreground))",
      },
      accent: {
        DEFAULT: "hsl(var(--accent))",
        foreground: "hsl(var(--accent-foreground))",
      },
      popover: {
        DEFAULT: "hsl(var(--popover))",
        foreground: "hsl(var(--popover-foreground))",
      },
      tooltip: {
        DEFAULT: "hsl(var(--tooltip))",
        foreground: "hsl(var(--tooltip-foreground))",
      },
      card: {
        DEFAULT: "hsl(var(--card))",
        foreground: "hsl(var(--card-foreground))",
      },
    },
    borderRadius: {
      xl: `calc(var(--radius) + 4px)`,
      lg: "var(--radius)",
      md: "calc(var(--radius) - 2px)",
      sm: "calc(var(--radius) - 4px)",
    },
    fontFamily: {
      sans: ["var(--font-sans)", ...fontFamily.sans],
      serif: ["var(--font-serif)", ...fontFamily.serif],
      mono: ["var(--font-mono)", ...fontFamily.mono],
      code: ["var(--font-code)", ...fontFamily.mono],
      heading: ["var(--font-heading)", ...fontFamily.sans],
      "heading-2": ["var(--font-heading-2)", ...fontFamily.sans],
      "heading-3": ["var(--font-heading-3)", ...fontFamily.sans],
    },
    keyframes: {
      "accordion-down": {
        from: { height: "0" },
        to: { height: "var(--radix-accordion-content-height)" },
      },
      "accordion-up": {
        from: { height: "var(--radix-accordion-content-height)" },
        to: { height: "0" },
      },
    },
    animation: {
      "accordion-down": "accordion-down 0.2s ease-out",
      "accordion-up": "accordion-up 0.2s ease-out",
    },
  },
};

export const plugins = [
  require("tailwindcss-animate"),
  plugin(function ({ addUtilities }) {
    addUtilities({
      // The titlebar which replaces the native (default) titlebar is draggable; set .drag-none on
      // inner elements that need to be clickable / interactive, like buttons, inputs, etc.
      ".drag-none": {
        "-webkit-app-region": "no-drag",
        // "-webkit-user-drag": "none",
        // "-khtml-user-drag": "none",
        // "-moz-user-drag": "none",
        // "-o-user-drag": "none",
        // "user-drag": "none",
      },
    });
  }),
];
