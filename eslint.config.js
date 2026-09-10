// Minimal on purpose: this exists to catch exactly one class of
// build-passing runtime crash — hooks-order violations (React #310, hit
// 2026-09-10 in Profile.jsx). Style/formatting stay out of scope.
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  {
    files: ['src/**/*.{js,jsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: {
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'off', // intentional deps are annotated inline
    },
  },
];
