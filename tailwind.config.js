/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.tsx', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#D4B87A',
          light: '#EBD9B0',
          muted: '#A89258',
          dark: '#7D693D',
        },
        background: {
          DEFAULT: '#050608',
          light: '#050608',
          warm: '#0C0A08',
        },
        surface: {
          DEFAULT: '#0A0C10',
          light: '#0A0C10',
          elevated: '#101318',
        },
        border: {
          DEFAULT: '#2A2A32',
          subtle: '#1B1D22',
        },
        muted: '#9A9BAA',
        foreground: {
          DEFAULT: '#F5F0E6',
          light: '#F5F0E6',
        },
        scripture: '#F2E6C8',
        ink: '#16130E',
        accent: '#C97A7A',
        live: '#C97A7A',
      },
      letterSpacing: {
        brand: '0.12em',
        sacred: '0.04em',
      },
      lineHeight: {
        scripture: '1.9',
      },
    },
  },
  plugins: [],
};
