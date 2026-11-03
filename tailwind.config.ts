import type { Config } from 'tailwindcss';

// Warna memakai CSS variable (lihat globals.css) supaya mode terang/gelap cukup mengganti variabel.
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: token('paper'),
        panel: token('panel'),
        ink: token('ink'),
        soft: token('soft'),
        rule: token('rule'),
        accent: token('accent'),
        'accent-ink': token('accent-ink'),
        ok: token('ok'),
        warn: token('warn'),
        bad: token('bad'),
      },
      fontFamily: {
        display: ['var(--font-display)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: { sheet: '1.25rem' },
    },
  },
  plugins: [],
};

export default config;
