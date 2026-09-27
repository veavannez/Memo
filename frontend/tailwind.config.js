/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Bebas Neue — editorial poster headings (MEMO, section titles)
        display: ['"Bebas Neue"', 'system-ui', 'sans-serif'],
        // DM Sans — all UI: buttons, nav, cards, forms
        sans: ['"DM Sans"', '-apple-system', 'system-ui', 'sans-serif'],
        // Caveat — sticky notes, annotations, handwritten accents
        handwritten: ['"Caveat"', 'cursive'],
        // JetBrains Mono — branches, hashes, filenames, technical metadata
        mono: ['"JetBrains Mono"', 'Consolas', 'monospace'],
      },
      colors: {
        paper: {
          DEFAULT: '#F5F2EC',
          dark:    '#EDE9DF',
          cream:   '#FAF8F3',
        },
        ink: {
          DEFAULT: '#0F0F0F',
          soft:    '#2C2C2C',
          muted:   '#6B6B6B',
          faint:   '#A8A8A8',
        },
        sticky: {
          yellow:   '#F5E642',
          green:    '#A8E6A3',
          pink:     '#F4A7B9',
          blue:     '#A3C4F5',
          orange:   '#F5C87A',
          lavender: '#C5B8F5',
        },
        border: {
          DEFAULT: '#D4CFC4',
          strong:  '#0F0F0F',
        },
      },
      borderRadius: {
        'editorial': '2px',
        'card':      '6px',
        'sticky':    '3px',
        'pill':      '9999px',
      },
      boxShadow: {
        'editorial':    '3px 3px 0px 0px #0F0F0F',
        'editorial-sm': '2px 2px 0px 0px #0F0F0F',
        'editorial-lg': '5px 5px 0px 0px #0F0F0F',
        'sticky':       '2px 4px 10px rgba(0,0,0,0.14)',
        'sticky-hover': '4px 8px 20px rgba(0,0,0,0.22)',
        'lift':         '0 4px 24px rgba(0,0,0,0.08)',
        'monitor':      '0 20px 60px rgba(0,0,0,0.25)',
        'none':         'none',
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
        // Monitor slides in from the right once — no loop
        'monitor-enter': {
          '0%':   { opacity: '0', transform: 'translateX(60px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        // Note settles once — drops in, rotates to final angle, stops
        'note-settle': {
          '0%':   { opacity: '0', transform: 'translateY(-24px) scale(0.88) rotate(0deg)' },
          '70%':  { opacity: '1', transform: 'translateY(3px)  scale(1.02)' },
          '100%': { opacity: '1', transform: 'translateY(0)     scale(1)' },
        },
        'hero-line': {
          '0%':   { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'marquee': {
          'from': { transform: 'translateX(0)' },
          'to':   { transform: 'translateX(-50%)' },
        },
        'pulse-dot': {
          '0%,100%': { transform: 'scale(1)',   opacity: '1'   },
          '50%':     { transform: 'scale(1.6)', opacity: '0.5' },
        },
        'shimmer': {
          '0%':   { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition:  '200% center' },
        },
        'fade-in': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        'fade-up':       'fade-up 0.45s ease forwards',
        'scale-in':      'scale-in 0.3s ease forwards',
        'monitor-enter': 'monitor-enter 0.7s cubic-bezier(0.22,1,0.36,1) forwards',
        'note-settle':   'note-settle 0.55s cubic-bezier(0.34,1.3,0.64,1) forwards',
        'hero-line':     'hero-line 0.5s ease forwards',
        'marquee':       'marquee 28s linear infinite',
        'pulse-dot':     'pulse-dot 1.8s ease-in-out infinite',
        'shimmer':       'shimmer 2.8s linear infinite',
        'fade-in':       'fade-in 0.4s ease forwards',
      },
    },
  },
  plugins: [],
}
