/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Editorial display — oversized headings
        display: ['"Space Grotesk"', '"Inter"', 'system-ui', 'sans-serif'],
        // Body copy
        sans: ['"Inter"', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        // Mono — code, IDs, labels
        mono: ['"JetBrains Mono"', '"Fira Code"', 'Consolas', 'monospace'],
      },
      colors: {
        // Paper backgrounds
        paper: {
          DEFAULT: '#F5F2EC',   // warm off-white base
          dark:    '#EDE9DF',   // slightly darker paper
          cream:   '#FAF8F3',   // near-white paper
        },
        ink: {
          DEFAULT: '#0F0F0F',   // near-black for headings
          soft:    '#2C2C2C',   // body text
          muted:   '#6B6B6B',   // secondary text
          faint:   '#A8A8A8',   // placeholder / disabled
        },
        // Sticky-note accent palette
        sticky: {
          yellow:  '#F5E642',   // primary sticky
          green:   '#A8E6A3',   // done / success
          pink:    '#F4A7B9',   // blocked / alert
          blue:    '#A3C4F5',   // in-progress
          orange:  '#F5C87A',   // warning / medium priority
          lavender:'#C5B8F5',   // notes / misc
        },
        border: {
          DEFAULT: '#D4CFC4',   // warm grey border
          strong:  '#0F0F0F',   // black border for editorial framing
        },
      },
      fontSize: {
        // Display scale — editorial oversized
        'display-2xl': ['clamp(3rem, 8vw, 7rem)',   { lineHeight: '0.95', letterSpacing: '-0.03em', fontWeight: '800' }],
        'display-xl':  ['clamp(2.2rem, 5vw, 4.5rem)', { lineHeight: '1.0',  letterSpacing: '-0.025em', fontWeight: '800' }],
        'display-lg':  ['clamp(1.6rem, 3vw, 2.8rem)', { lineHeight: '1.05', letterSpacing: '-0.02em',  fontWeight: '700' }],
        'display-md':  ['clamp(1.2rem, 2vw, 1.8rem)', { lineHeight: '1.15', letterSpacing: '-0.015em', fontWeight: '700' }],
      },
      borderRadius: {
        'editorial': '2px',    // tight editorial borders
        'card':      '6px',
        'sticky':    '3px',
        'pill':      '9999px',
      },
      boxShadow: {
        'editorial': '3px 3px 0px 0px #0F0F0F',
        'editorial-sm': '2px 2px 0px 0px #0F0F0F',
        'editorial-lg': '5px 5px 0px 0px #0F0F0F',
        'sticky':    '2px 3px 8px 0px rgba(0,0,0,0.12)',
        'lift':      '0 4px 24px rgba(0,0,0,0.08)',
        'none':      'none',
      },
      rotate: {
        '1':  '1deg',
        '2':  '2deg',
        '-1': '-1deg',
        '-2': '-2deg',
        '-3': '-3deg',
        '3':  '3deg',
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
        '26': '6.5rem',
      },
      keyframes: {
        'fade-up': {
          '0%':   { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%':   { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-up':  'fade-up 0.4s ease forwards',
        'scale-in': 'scale-in 0.3s ease forwards',
      },
    },
  },
  plugins: [],
}
