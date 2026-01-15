import {type FlatXoConfig} from 'xo';

const xoConfig: FlatXoConfig = [
	{
		ignores: ['node_modules', 'dist'],
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
	// Demo files - looser rules for example code
	{
		files: ['demos/**/*.ts', 'demos/**/*.tsx'],
		react: true,
		prettier: true,
		space: true,
		semicolon: true,
		rules: {
			// Disable stylistic rules
			'@stylistic/indent': 'off',
			'@stylistic/object-curly-newline': 'off',
			'@stylistic/no-mixed-operators': 'off',
			'no-mixed-operators': 'off',

			// React rules
			'react/react-in-jsx-scope': 'off',

			// Looser TypeScript rules for demos
			'@typescript-eslint/no-unsafe-assignment': 'off',
			'@typescript-eslint/no-unsafe-call': 'off',
			'@typescript-eslint/no-unsafe-argument': 'off',
			'@typescript-eslint/restrict-plus-operands': 'off',
			'@typescript-eslint/explicit-function-return-type': 'off',
			'@typescript-eslint/naming-convention': 'off',
			'@typescript-eslint/capitalized-comments': 'off',
			'capitalized-comments': 'off',
			'unicorn/prevent-abbreviations': 'off',
			'unicorn/filename-case': 'off',

			// Import rules
			'import-x/extensions': 'off',
			'n/file-extension-in-import': 'off',
		},
	},
	// E2E test files - Playwright tests
	{
		files: ['playwright/**/*.ts'],
		prettier: true,
		space: true,
		semicolon: true,
		rules: {
			// Disable stylistic rules
			'@stylistic/indent': 'off',
			'@stylistic/object-curly-newline': 'off',
			'@stylistic/no-mixed-operators': 'off',
			'no-mixed-operators': 'off',

			// Playwright test functions are typed properly but xo doesn't understand them
			'@typescript-eslint/no-unsafe-call': 'off',
			'@typescript-eslint/no-unsafe-assignment': 'off',
			'@typescript-eslint/no-unsafe-member-access': 'off',
			'@typescript-eslint/no-unsafe-argument': 'off',

			// Test files don't need explicit return types
			'@typescript-eslint/explicit-function-return-type': 'off',

			// Allow naming conventions for Playwright config
			'@typescript-eslint/naming-convention': 'off',

			// Allow process.env in config
			'n/prefer-global/process': 'off',

			// Disable comment rules
			'@typescript-eslint/capitalized-comments': 'off',
			'capitalized-comments': 'off',
			'unicorn/prevent-abbreviations': 'off',

			// Sequential awaits are intentional in e2e tests
			'no-await-in-loop': 'off',

			// Import rules
			'import-x/extensions': 'off',
			'n/file-extension-in-import': 'off',
		},
	},
	// Xo.config.ts itself
	{
		files: ['xo.config.ts'],
		rules: {
			'@typescript-eslint/naming-convention': 'off',
		},
	},
];

export default xoConfig;
