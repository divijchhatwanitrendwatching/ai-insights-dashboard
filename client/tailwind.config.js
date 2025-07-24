/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Libre Franklin', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: '#005EB8',
        primaryHover: '#004494',
        text: '#1D1D1D',
        bg: '#FAFBFC',
        accentLight: '#F1F3F5',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
