import {type FlatXoConfig, type XoConfigItem} from 'xo';

type ImportPattern = {readonly regex: string; readonly message: string};

const imports = {
	reactNative: {regex: '^react-native(/|$)', message: 'Only the React Native entry may import React Native.'},
	reactDom: {regex: '^react-dom(/|$)', message: 'Only the web entry may import react-dom.'},
	webPlatform: {regex: '(^|/)react-platform(/|$)', message: 'Only the web entry may import the web platform.'},
	nativePlatform: {
		regex: '(^|/)react-native-platform(/|$)',
		message: 'Only the React Native entry may import the React Native platform.',
	},
} satisfies Record<string, ImportPattern>;

/** Each published entry only reaches its own platform: the web build never loads React Native, and the other way round. */
function platformBoundary(files: string[], forbidden: ImportPattern[]): XoConfigItem {
	return {
		files,
		rules: {'no-restricted-imports': ['error', {patterns: forbidden}]},
	};
}

const xoConfig: FlatXoConfig = [
	{
		// The demos are separate apps, checked by their own toolchains (tsc, ESLint, Expo). The lint
		// scripts also pass `--ignore "demos/**"`: xo reads the tsconfig of every file it finds before
		// applying these ignores, and the demos' tsconfigs extend packages only their own installs have.
		ignores: ['node_modules', 'dist', 'demos'],
	},
	{
		files: ['src/**/*.ts', 'src/**/*.tsx', 'test/**/*.ts', 'test/**/*.tsx'],
		ignores: ['test/e2e/**'],
		react: true,
		prettier: true,
		space: true,
		semicolon: true,
		rules: {
			// Disable stylistic rules - let prettier handle formatting
			'@stylistic/indent': 'off',
			'@stylistic/object-curly-newline': 'off',
			'@stylistic/curly-newline': 'off',
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

			// `const [instance] = useState(() => create())` is the idiomatic way to create a stable instance once
			'react/hook-use-state': 'off',

			// The `v` flag is ES2024 and a syntax error on Hermes (React Native) and Safari 16; `u` is enough
			'require-unicode-regexp': ['error', {}],

			// Import rules - disable file extension requirements
			'import-x/extensions': 'off',
			'n/file-extension-in-import': 'off',
		},
	},
	platformBoundary(['src/shared/**'], [imports.reactNative, imports.reactDom, imports.webPlatform, imports.nativePlatform]),
	platformBoundary(['src/react.ts', 'src/react-platform/**'], [imports.reactNative, imports.nativePlatform]),
	platformBoundary(['src/react-native.ts', 'src/react-native-platform/**'], [imports.reactDom, imports.webPlatform]),
	// Unit and component tests
	{
		files: ['test/**/*.ts', 'test/**/*.tsx'],
		ignores: ['test/e2e/**'],
		rules: {
			// Test callbacks and inline components don't need explicit return types
			'@typescript-eslint/explicit-function-return-type': 'off',
			// Assertions on values the test just set up
			'@typescript-eslint/no-non-null-assertion': 'off',
			// No-op stubs
			'@typescript-eslint/no-empty-function': 'off',
			// Sequential awaits are intentional in tests
			'no-await-in-loop': 'off',
			// Fixtures build objects of known shape
			'@typescript-eslint/no-unsafe-type-assertion': 'off',
			'react/boolean-prop-naming': 'off',
			'react/jsx-no-bind': 'off',
			// Inline test components are typed by the harness they implement
			'react/prop-types': 'off',
			'max-params': 'off',
			// Tests capture hook results and count renders on purpose
			'react-hooks/globals': 'off',
			// Mock implementations and assertion helpers return values freely
			'@typescript-eslint/strict-void-return': 'off',
			'@typescript-eslint/no-unsafe-assignment': 'off',
			// Exhaustive loops over input combinations
			'max-depth': 'off',
			// Tests run on Node and modern browsers only
			'unicorn/no-array-sort': 'off',
		},
	},
	// Node scripts and tool configuration (same formatting as the source: Prettier with spaces)
	{
		files: ['test/**/*.mjs', 'vitest.config.ts', 'playwright.config.ts'],
		prettier: true,
		space: true,
		semicolon: true,
		rules: {
			'@stylistic/indent': 'off',
			// Config files are not part of the type-aware project
			'@typescript-eslint/no-unsafe-call': 'off',
			'@typescript-eslint/no-unsafe-assignment': 'off',
			'@typescript-eslint/no-unsafe-member-access': 'off',
			'@typescript-eslint/no-unsafe-argument': 'off',
			'@typescript-eslint/no-confusing-void-expression': 'off',
			'no-console': 'off',
			'n/prefer-global/process': 'off',
			'unicorn/no-process-exit': 'off',
			'@typescript-eslint/naming-convention': 'off',
		},
	},
	// E2E test files - Playwright tests
	{
		files: ['test/e2e/**/*.ts'],
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
