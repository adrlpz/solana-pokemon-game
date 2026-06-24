/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        fire: '#F08030',
        water: '#6890F0',
        earth: '#8B6914',
        electric: '#F8D030',
        shadow: '#705848',
        light: '#F8F8F8',
        solmon: {
          primary: '#6C3CE1',
          secondary: '#14F195',
          dark: '#0F0F23',
          light: '#1A1A3E',
        },
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', 'monospace'],
        game: ['"Exo 2"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
