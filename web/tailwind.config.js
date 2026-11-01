/** @type {import('tailwindcss').Config} */
export default {
  content: ['./app/**/*.{js,jsx}', './src/**/*.{js,jsx}'],
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
        accent: '#83D63B',
        accentBlue: '#B0B3B8',
        success: '#22C55E',
        warning: '#F59E0B',
        danger: '#EF4444',
      },
      fontFamily: {
        sans: ['Neue Montreal', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: 'none',
      },
    },
  },
  plugins: [],
};
