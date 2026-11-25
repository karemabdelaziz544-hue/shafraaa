/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // أسماء الألوان الأساسية من لوحة MP072
        palladian: 'rgb(var(--color-palladian) / <alpha-value>)',
        oatmeal: 'rgb(var(--color-oatmeal) / <alpha-value>)',
        fantastic: 'rgb(var(--color-fantastic) / <alpha-value>)',
        abyssal: 'rgb(var(--color-abyssal) / <alpha-value>)',
        flame: {
          DEFAULT: 'rgb(var(--color-flame) / <alpha-value>)',
          hover: 'rgb(var(--color-flame-hover) / <alpha-value>)',
          ink: 'rgb(var(--color-accent-ink) / <alpha-value>)',
        },
        truffle: {
          DEFAULT: 'rgb(var(--color-truffle) / <alpha-value>)',
          ink: 'rgb(var(--color-secondary-ink) / <alpha-value>)',
        },
        // الرموز الدلالية المتكيفة مع الوضع الفاتح والداكن
        canvas: 'rgb(var(--color-canvas) / <alpha-value>)',
        surface: {
          DEFAULT: 'rgb(var(--color-surface) / <alpha-value>)',
          alt: 'rgb(var(--color-surface-alt) / <alpha-value>)',
        },
        line: 'rgb(var(--color-border) / <alpha-value>)',
        divider: 'rgb(var(--color-divider) / <alpha-value>)',
        ink: {
          DEFAULT: 'rgb(var(--color-ink) / <alpha-value>)',
          strong: 'rgb(var(--color-ink-strong) / <alpha-value>)',
          muted: 'rgb(var(--color-ink-muted) / <alpha-value>)',
        },
        success: {
          DEFAULT: 'rgb(var(--color-success) / <alpha-value>)',
          bg: 'rgb(var(--color-success-bg) / <alpha-value>)',
          border: 'rgb(var(--color-success-border) / <alpha-value>)',
          ink: 'rgb(var(--color-success-ink) / <alpha-value>)',
        },
        warning: {
          DEFAULT: 'rgb(var(--color-warning) / <alpha-value>)',
          bg: 'rgb(var(--color-warning-bg) / <alpha-value>)',
          border: 'rgb(var(--color-warning-border) / <alpha-value>)',
        },
        danger: {
          DEFAULT: 'rgb(var(--color-danger) / <alpha-value>)',
          text: 'rgb(var(--color-danger-text) / <alpha-value>)',
          bg: 'rgb(var(--color-danger-bg) / <alpha-value>)',
          border: 'rgb(var(--color-danger-border) / <alpha-value>)',
          ink: 'rgb(var(--color-danger-ink) / <alpha-value>)',
        },
        info: {
          DEFAULT: 'rgb(var(--color-info) / <alpha-value>)',
          bg: 'rgb(var(--color-info-bg) / <alpha-value>)',
          border: 'rgb(var(--color-info-border) / <alpha-value>)',
        },
      },
      fontFamily: {
        cairo: ['Cairo', 'Tajawal', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        elevated: 'var(--shadow-elevated)',
        accent: 'var(--shadow-accent)',
      },
    },
  },
  plugins: [],
};
