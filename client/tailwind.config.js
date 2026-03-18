/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        felt: {
          DEFAULT: '#1a6b3c',
          dark: '#124d2b',
          light: '#2a8a50',
        },
      },
    },
  },
  plugins: [],
};
