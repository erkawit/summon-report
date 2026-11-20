import type { Config } from 'tailwindcss';
import forms from '@tailwindcss/forms';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sarabun)', 'Sarabun', 'TH SarabunPSK', 'Tahoma', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#eef4fb', 100: '#d6e3f4', 200: '#adc7e9', 300: '#7ea5da', 400: '#4f80c6',
          500: '#2f62ad', 600: '#224c8c', 700: '#1c3d70', 800: '#172f55', 900: '#10213c',
        },
        gold: { 400: '#d9b45a', 500: '#c59a36', 600: '#a67f25' },
      },
      boxShadow: { card: '0 1px 2px rgba(16,33,60,.06), 0 1px 8px rgba(16,33,60,.06)' },
    },
  },
  plugins: [forms],
};

export default config;
