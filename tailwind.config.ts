import type { Config } from "tailwindcss";

const config: Config = {
  future: {
    hoverOnlyWhenSupported: true,
  },
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: "1rem",
        sm: "1.5rem",
        lg: "2rem",
      },
      screens: {
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1200px",
        "2xl": "1200px",
      },
    },
    extend: {
      maxWidth: {
        container: "1200px",
      },
      colors: {
        "navy-950": "#0B121A",
        "navy-900": "#111C27",
        "navy-700": "#1E2E3E",
        ivory: "#F4F1EC",
        silver: "#A9B4BF",
        "brand-red": "#C8102E",
        "whatsapp-green": "#25D366",
      },
      fontFamily: {
        serif: ["var(--font-heading)", "Georgia", "serif"],
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        wordmark: ["var(--font-serif)", "Georgia", "serif"],
      },
      letterSpacing: {
        wordmark: "0.22em",
      },
    },
  },
  plugins: [],
};

export default config;
