/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // CRITICAL: This allows manual toggling via the 'dark' class
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Noto Sans SC"', '"Noto Sans TC"', '"Noto Sans JP"', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      }
    },
  },
  plugins: [],
}