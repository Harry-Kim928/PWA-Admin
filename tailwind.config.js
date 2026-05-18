/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        qanda: { orange: "#FF6B1A" },
      },
    },
  },
  plugins: [],
}
