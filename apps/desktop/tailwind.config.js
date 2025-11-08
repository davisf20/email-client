/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    '../../packages/ui-kit/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Color palette principale
        palette: {
          black: '#000000',
          'cadet-gray': '#9D9D9D',
          jonquil: '#FFC900',
          'light-cyan': '#CDEDF4',
        },
        // Varianti con trasparenza
        'anti-flash-white': {
          DEFAULT: '#F1F1F1',
          '90': 'rgba(241, 241, 241, 0.9)',
        },
        silver: {
          DEFAULT: '#A9A9A9',
          '25': 'rgba(169, 169, 169, 0.25)',
          '35': 'rgba(169, 169, 169, 0.35)',
        },
        'baby-powder': {
          DEFAULT: '#FAFDF6',
        },
        dark: {
          bg: '#ffffff',
          surface: 'rgba(255, 255, 255, 0.7)',
          surfaceHover: 'rgba(255, 255, 255, 0.9)',
          border: 'rgba(0, 0, 0, 0.1)',
          text: '#1a1a1a',
          textMuted: '#666666',
        },
        light: {
          bg: '#f8f8f8',
          surface: 'rgba(255, 255, 255, 0.8)',
          surfaceHover: 'rgba(255, 255, 255, 0.95)',
          border: 'rgba(0, 0, 0, 0.08)',
          text: '#1a1a1a',
          textMuted: '#666666',
        },
        selected: {
          bg: '#fff4e6',
          text: '#d97706',
          icon: '#f59e0b',
        },
      },
    },
  },
  plugins: [],
};

