import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // TTS Brand Colors
        primary: {
          DEFAULT: "#1A5FAB",
          dark: "#154D8A",
          light: "#E8F0FB",
          foreground: "#FFFFFF",
        },
        accent: {
          DEFAULT: "#F5A623",
          light: "#FEF3DC",
          foreground: "#FFFFFF",
        },
        // Semantic Colors
        success: {
          DEFAULT: "#27AE60",
          light: "#E8F8EF",
          foreground: "#FFFFFF",
        },
        warning: {
          DEFAULT: "#F5A623",
          light: "#FEF3DC",
          foreground: "#FFFFFF",
        },
        error: {
          DEFAULT: "#E74C3C",
          light: "#FDECEA",
          foreground: "#FFFFFF",
        },
        info: {
          DEFAULT: "#2980B9",
          light: "#EAF4FB",
          foreground: "#FFFFFF",
        },
        // Background
        "bg-page": "#F4F6F8",
        "bg-card": "#FFFFFF",
        "bg-sidebar": "#FFFFFF",
        // Text
        "text-primary": "#1A202C",
        "text-secondary": "#718096",
        "text-disabled": "#CBD5E0",
        // Border
        border: "#E2E8F0",
      },
      fontFamily: {
        sans: ["Roboto", "sans-serif"],
      },
      borderRadius: {
        lg: "8px",
        md: "6px",
        sm: "4px",
      },
      boxShadow: {
        card: "0 1px 4px rgba(0,0,0,0.06)",
        topbar: "0 1px 3px rgba(0,0,0,0.08)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
