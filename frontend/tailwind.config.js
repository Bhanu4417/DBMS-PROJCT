/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--bg) / <alpha-value>)',
        panel: 'rgb(var(--panel) / <alpha-value>)',
        card: 'rgb(var(--card) / <alpha-value>)',
        soft: 'rgb(var(--soft) / <alpha-value>)',
        line: 'rgb(var(--border) / <alpha-value>)',
        ink: 'rgb(var(--text) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        accent: '#7C5CFF',
        accentBlue: '#4F8CFF',
        success: '#22C55E',
        warning: '#F59E0B',
        danger: '#EF4444',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 23, 42, 0.06), 0 8px 24px -16px rgba(15, 23, 42, 0.35)',
      },
    },
  },
  plugins: [],
};
