/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        oak: ['OakSans', 'sans-serif'],
      },
      colors: {
        brand: {
          black: '#000000',
          white: '#ffffff',
          grey: '#f4f4f4',
          accent: '#e5e5e5',
        }
      }
    },
  },
  plugins: [],
}
