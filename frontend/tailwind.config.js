/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Outfit"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        brand: {
          50: '#f0f4ff',
          100: '#e0e9ff',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          900: '#1e1b4b',
        },
        midnight: {
          800: '#14141e',
          900: '#0a0a0f',
          950: '#050508',
        }
      },
      animation: {
        'mesh': 'mesh 15s ease-in-out infinite alternate',
        'float': 'float 6s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 3s ease-in-out infinite alternate',
      },
      keyframes: {
        mesh: {
          '0%': { transform: 'scale(1.1) translate(0, 0)' },
          '100%': { transform: 'scale(1) translate(-2%, 5%)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        pulseGlow: {
          '0%': { opacity: 0.6, transform: 'scale(1)' },
          '100%': { opacity: 1, transform: 'scale(1.05)' },
        }
      },
      boxShadow: {
        'glass-inner': 'inset 0 1px 1px 0 rgba(255, 255, 255, 0.1), inset 0 -1px 1px 0 rgba(255, 255, 255, 0.02)',
        'glass-glow': '0 0 20px 0 rgba(99, 102, 241, 0.15), inset 0 1px 1px 0 rgba(255, 255, 255, 0.1)',
      }
    },
  },
  plugins: [],
}
