/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.tsx', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#C9A227',
          light: '#E8D48B',
          dark: '#9A7B1A',
        },
        background: {
          DEFAULT: '#0F1419',
          light: '#F8F6F0',
        },
        surface: {
          DEFAULT: '#1A2332',
          light: '#FFFFFF',
        },
        muted: '#6B7280',
        foreground: {
          DEFAULT: '#F8F6F0',
          light: '#1A2332',
        },
      },
    },
  },
  plugins: [],
};