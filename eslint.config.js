// Minimal on purpose: this exists to catch build-passing runtime crashes,
// nothing else. Style/formatting stay out of scope. Two classes so far:
//   - hooks-order violations (React #310, hit 2026-09-10 in Profile.jsx)
//   - undefined identifiers, typically a JSX component used without its
//     import (hit 2026-09-16 in Settings.jsx: <TrendingUp> with no import —
//     Vite builds it fine and it explodes on render)
//   - the same class in functions/ (hit 2026-09-20 in stylist.js: a renamed
//     local still referenced by its old name, deployed, 500s on every
//     styleRecommend until the log was read). Cloud Functions have no build
//     step at all, so nothing but this looks at them before they ship.
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default [
  {
    files: ['src/**/*.{js,jsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: {
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.es2021, __APP_VERSION__: 'readonly' },
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'off', // intentional deps are annotated inline
      // JSX tags read as variable references, so this catches a missing
      // component import — which nothing else in the pipeline does.
      'no-undef': 'error',
    },
  },
  {
    // Node, not browser: no JSX, CommonJS, and `exports`/`require` are globals.
    files: ['functions/**/*.js'],
    ignores: ['functions/node_modules/**'],
    languageOptions: {
      parserOptions: { ecmaVersion: 'latest', sourceType: 'commonjs' },
      globals: { ...globals.node, ...globals.es2021 },
    },
    rules: { 'no-undef': 'error' },
  },
];
