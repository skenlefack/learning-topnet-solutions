/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          navy: '#1B0CB3',
          'navy-deep': '#0D0670',
          'navy-light': '#E8E6F8',
          gold: '#00B341',
          'gold-dark': '#009930',
          'gold-light': '#b3e6c7',
          'gold-pale': '#E8F8EE',
          maroon: '#A09060',
          'maroon-light': '#F5F0E5',
        },
        surface: {
          DEFAULT: '#F5F6FA',
          alt: '#ECEDF5',
          card: '#FFFFFF',
          dark: '#0a0e1a',
          'dark-card': '#111827',
          'dark-alt': '#1a2035',
        },
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', '"Noto Sans"', '"Liberation Sans"', 'Arial', 'sans-serif'],
        display: ['system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
        arabic: ['var(--font-arabic)', '"Noto Sans Arabic"', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-up': 'fadeUp 0.5s ease forwards',
        'slide-in': 'slideIn 0.35s ease forwards',
        float: 'float 5s ease-in-out infinite',
      },
      keyframes: {
        fadeUp: { from: { opacity: 0, transform: 'translateY(16px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        slideIn: { from: { opacity: 0, transform: 'translateX(-14px)' }, to: { opacity: 1, transform: 'translateX(0)' } },
        float: { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-5px)' } },
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
