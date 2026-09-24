import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // The garden at night
        night: "#0e1630",
        moon: "#e6e4f2",
        lantern: "#f3d37f",
        // Airmail stationery
        paper: "#f3eff6",
        envelope: "#e3e1ef",
        flap: "#d6d3e8",
        ink: "#272a4c",
        rose: "#d9728f",
        air: "#33407a",
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        hand: ["var(--font-hand)", "cursive"],
      },
      boxShadow: {
        letter: "0 40px 80px -30px rgba(3, 5, 18, 0.85), 0 16px 30px -18px rgba(3, 5, 18, 0.6)",
      },
    },
  },
  plugins: [],
};
export default config;
