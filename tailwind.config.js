/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg0: 'var(--bg0)',
        bg1: 'var(--bg1)',
        card: 'var(--card)',
        border: 'var(--border)',
        primary: 'var(--primary)',
        primary2: 'var(--primary2)',
        glow: 'var(--glow)',
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 24px var(--glow)',
        'glow-sm': '0 0 12px var(--glow)',
      },
    },
  },
  plugins: [],
};
