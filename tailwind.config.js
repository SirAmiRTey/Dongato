/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
        },
        surface: {
          base: '#0b132b',
          card: '#1c2541',
          cardHover: '#233054',
          input: '#151d38',
          border: '#2a375e',
          subtle: '#0e1736',
        },
        credit: {
          light: '#34d399',
          DEFAULT: '#10b981',
          dark: '#059669',
          bg: 'rgba(16, 185, 129, 0.12)',
          border: 'rgba(16, 185, 129, 0.3)',
        },
        debt: {
          light: '#fb7185',
          DEFAULT: '#f43f5e',
          dark: '#e11d48',
          bg: 'rgba(244, 63, 94, 0.12)',
          border: 'rgba(244, 63, 94, 0.3)',
        }
      },
      fontFamily: {
        sans: ['Vazirmatn', 'Peyda', 'system-ui', '-apple-system', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
