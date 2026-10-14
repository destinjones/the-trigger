import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['node_modules', 'web/dist', 'web/.astro', 'data', '**/*.astro'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    rules: {
      // The model must stay deterministic: no wall-clock reads in index/.
      'no-restricted-syntax': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' }],
    },
  },
  {
    files: ['index/**/*.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'Date', property: 'now', message: 'The model is pure. Pass the date in.' },
        { object: 'Math', property: 'random', message: 'The model is deterministic.' },
      ],
      'no-restricted-globals': ['error', { name: 'fetch', message: 'The model does no I/O.' }],
    },
  },
);
