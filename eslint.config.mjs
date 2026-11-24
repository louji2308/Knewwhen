import tseslint from 'typescript-eslint';

export default [
  {
    ignores: [
      'node_modules/**',
      '.opencode/**',
      'docs/**',
      'evidence/**',
      'coverage/**',
      'dist/**',
      'package-lock.json',
    ],
  },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.mjs'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module' },
  },
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module' },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // AGENTS 12.4: core/ imports nothing from @forge/*; adapters are the only runtime bridge.
    files: ['src/**/*.{ts,tsx,mts,cts}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@forge/*', '@forge/**', '@forge'],
              message: 'Only src/adapters/ may import @forge/* (AGENTS 12.4)',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/adapters/**/*.{ts,tsx,mts,cts}'],
    rules: { 'no-restricted-imports': 'off' },
  },
];
