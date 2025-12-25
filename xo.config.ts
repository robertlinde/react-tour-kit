import {type FlatXoConfig} from 'xo';

const xoConfig: FlatXoConfig = [
	{
		ignores: ['node_modules', 'dist', 'demo', 'demo-native', 'demos'],
	},
	{
		files: ['src/**/*.ts', 'src/**/*.tsx'],
		react: true,
		prettier: true,
		space: true,
		semicolon: true,
		rules: {
			// Disable stylistic rules - let prettier handle formatting
			'@stylistic/indent': 'off',
			'@stylistic/object-curly-newline': 'off',
			'@stylistic/no-mixed-operators': 'off',
			'no-mixed-operators': 'off',

			// React 17+ doesn't need React in scope
			'react/react-in-jsx-scope': 'off',

			// Disable console logs
			'no-console': ['error'],

			// Force exhaustive dependencies in useEffect hooks
			'react-hooks/exhaustive-deps': 'error',

			// Disable annoying rules
			'@typescript-eslint/capitalized-comments': 'off',
			'capitalized-comments': 'off',
			'unicorn/prevent-abbreviations': 'off',

			// TypeScript rules
			'@typescript-eslint/explicit-function-return-type': 'error',
			'@typescript-eslint/no-explicit-any': 'error',
			'@typescript-eslint/no-non-null-assertion': 'error',
			'@typescript-eslint/no-var-requires': 'error',
			'@typescript-eslint/no-unused-vars': 'error',
			'@typescript-eslint/unified-signatures': 'off',
			'@typescript-eslint/naming-convention': [
				'error',
				{
					selector: 'variable',
					format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
				},
			],
			// Allow null type - project uses null for unset states
			'@typescript-eslint/no-restricted-types': 'off',
			// Allow consistent-type-exports to not require export type
			'@typescript-eslint/consistent-type-exports': 'off',

			// Code rules
			'max-params': 'error',

			// React rules - allow index keys for static lists like step dots
			'react/no-array-index-key': 'off',

			// Import rules - disable file extension requirements
			'import-x/extensions': 'off',
			'n/file-extension-in-import': 'off',
		},
	},
	// React Native files need special rules for dynamic imports
	{
		files: ['src/react-native-platform/**/*.ts', 'src/react-native-platform/**/*.tsx', 'src/react-native.ts'],
		rules: {
			// Dynamic require is needed to avoid bundling RN in web builds
			'unicorn/prefer-module': 'off',
			'@typescript-eslint/no-require-imports': 'off',
			'@typescript-eslint/no-var-requires': 'off',
			'@typescript-eslint/consistent-type-imports': 'off',
			// RN measure callback has 6 params
			'max-params': 'off',
			// Allow unused params prefixed with underscore (for interface compliance)
			'@typescript-eslint/no-unused-vars': ['error', {argsIgnorePattern: '^_', varsIgnorePattern: '^_'}],
		},
	},
];

export default xoConfig;
