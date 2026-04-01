/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // The Fluid Ledger Design System
        'fluid': {
          // Primary - Cyan (Water)
          'primary': '#00F2FF',
          'primary-dim': 'rgba(0, 242, 255, 0.5)',
          'primary-dimmer': 'rgba(0, 242, 255, 0.2)',
          // Secondary - Red (Alert)
          'secondary': '#DE0541',
          'secondary-dim': 'rgba(222, 5, 65, 0.5)',
          // Tertiary - Yellow/Gold (Warning/Highlight)
          'tertiary': '#FFD81D',
          'tertiary-dim': 'rgba(255, 216, 29, 0.5)',
          // Surface Colors
          'surface': '#10131A',
          'surface-high': '#161A22',
          'surface-higher': '#1C212B',
          'surface-container': '#191C22',
          'surface-container-low': '#14171E',
          'surface-container-lowest': '#0B0E14',
          // Outline
          'outline': '#3A494B',
          'outline-variant': '#2A3335',
          // Text Colors
          'text': '#E1E2EB',
          'text-muted': '#8B8D98',
          'text-dim': '#5C5E6A',
        },
        // Stock colors (A股习惯: 红涨绿跌)
        stock: {
          up: '#ef4444',    // 红色 (涨)
          down: '#22c55e',  // 绿色 (跌)
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        headline: ['Space Grotesk', 'Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      backdropBlur: {
        'glass': '20px',
      },
      boxShadow: {
        'glass': '0 8px 32px rgba(0, 0, 0, 0.4)',
        'glow-primary': '0 0 20px rgba(0, 242, 255, 0.3)',
        'glow-secondary': '0 0 20px rgba(222, 5, 65, 0.3)',
        'glow-tertiary': '0 0 15px rgba(255, 216, 29, 0.3)',
        'glow-node': '0 0 15px rgba(0, 242, 255, 0.3)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'flow': 'flow 20s linear infinite',
      },
      keyframes: {
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 15px rgba(0, 242, 255, 0.3)' },
          '50%': { boxShadow: '0 0 25px rgba(0, 242, 255, 0.5)' },
        },
        'flow': {
          '0%': { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '200% 50%' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
}
