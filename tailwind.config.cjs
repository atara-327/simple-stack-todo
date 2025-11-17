/** Tailwind configuration for renderer */
module.exports = {
  content: ["./index.html", "./src/renderer/**/*.{ts,tsx,jsx,js}"],
  theme: {
    extend: {
      colors: {
        aqua: {
          50: "#f1fbff",
          100: "#dff5ff",
          200: "#b7e9ff",
          300: "#76d7ff",
          400: "#2fc0ff"
        }
      }
    }
  },
  plugins: []
};
