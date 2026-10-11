import ts from 'typescript';
import {describe, expect, it} from 'vitest';
import type {TourProviderProps as NativeProviderProps} from '../../src/react-native.js';
import type {TourProviderProps as WebProviderProps} from '../../src/react.js';
import type {TourProviderBaseProps} from '../../src/shared/react/tour-provider-core.js';

/**
 * Both entry points offer the same API, except for what only makes sense on one platform. A new
 * export added to one entry fails here until it is added to the other, or declared platform-only.
 */
const onlyOnWeb = new Set<string>();
const onlyOnReactNative = new Set([
  // Registering views and scroll views: the web finds them with CSS selectors.
  'useTourTarget',
  'useTourScrollView',
  // Native modal screens are drawn above the app's root view; the web's top layer is above everything.
  'TourHost',
  'TourInsets',
]);
/** Exported by both, each platform with its own implementation (built on the same shared core). */
const perPlatform = new Set(['TourProvider', 'TourProviderProps']);

// The repository's tsconfig.json, found the way the compiler finds it.
const configFile =
  ts.findConfigFile(ts.sys.getCurrentDirectory(), (path) => ts.sys.fileExists(path)) ?? 'tsconfig.json';
const root = configFile.slice(0, configFile.lastIndexOf('/') + 1);
const webEntry = `${root}src/react.ts`;
const nativeEntry = `${root}src/react-native.ts`;

function createProgram(): ts.Program {
  const config = ts.readConfigFile(configFile, (path) => ts.sys.readFile(path));
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  return ts.createProgram([webEntry, nativeEntry], {...parsed.options, noEmit: true});
}

/** Exported names of an entry, each with where it is really declared (following re-exports). */
function exportsOf(program: ts.Program, file: string): Map<string, string> {
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(file);
  const moduleSymbol = source ? checker.getSymbolAtLocation(source) : undefined;
  if (!moduleSymbol) {
    throw new Error(`Cannot read the exports of ${file}`);
  }

  const result = new Map<string, string>();
  for (const symbol of checker.getExportsOfModule(moduleSymbol)) {
    // eslint-disable-next-line no-bitwise -- the compiler's symbol flags are a bit field
    const isReExport = (symbol.flags & ts.SymbolFlags.Alias) !== 0;
    const original = isReExport ? checker.getAliasedSymbol(symbol) : symbol;
    const declaration = original.declarations?.[0];
    result.set(symbol.name, declaration ? `${declaration.getSourceFile().fileName}:${declaration.pos}` : '?');
  }

  return result;
}

describe('the web and React Native entry points', () => {
  const program = createProgram();
  const web = exportsOf(program, webEntry);
  const native = exportsOf(program, nativeEntry);

  it('export the same names, apart from the declared platform-only ones', () => {
    const webNames = [...web.keys()].filter((name) => !onlyOnWeb.has(name)).sort();
    const nativeNames = [...native.keys()].filter((name) => !onlyOnReactNative.has(name)).sort();
    expect(nativeNames).toEqual(webNames);
    for (const name of [...onlyOnWeb, ...onlyOnReactNative]) {
      expect(web.has(name) && native.has(name), `${name} is declared platform-only but exported by both`).toBe(false);
    }
  });

  it('export the very same shared implementation for everything that is not per platform', () => {
    for (const [name, declaration] of web) {
      if (native.has(name) && !perPlatform.has(name)) {
        expect(native.get(name), `${name} must come from the shared code on both platforms`).toBe(declaration);
      }
    }
  });
});

// Checked by the type checker: both providers accept every shared prop.
type Assert<T extends true> = T;
type IsExactly<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
export type WebProviderPropsAreTheSharedProps = Assert<IsExactly<WebProviderProps, TourProviderBaseProps>>;
export type NativeProviderPropsExtendTheSharedProps = Assert<
  NativeProviderProps extends TourProviderBaseProps ? true : false
>;
