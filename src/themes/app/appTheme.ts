import {defineTheme} from '@astryxdesign/core/theme';
import {neutralTheme} from '@astryxdesign/theme-neutral';

/**
 * The single application theme. It extends the neutral theme but dark-first and
 * calm, and – most importantly – points the Astryx accent tokens at the runtime
 * `--tenant-accent` variable declared in globals.css. That variable is filled
 * from each studio's business config, so the same build serves every tenant and
 * the accent is never hardcoded in a business screen.
 */
export const appTheme = defineTheme({
  name: 'app',
  extends: neutralTheme,
  tokens: {
    '--color-accent': 'var(--tenant-accent)',
    '--color-background-body': '#0a0a0b',
    '--color-background-surface': '#141416',
    '--color-background-muted': '#1c1c1f',
  },
});
