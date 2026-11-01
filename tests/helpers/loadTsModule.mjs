import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Exercise the real class in Node without booting Phaser's browser renderer.
export function loadTsModule(url, dependencies, globals = {}) {
  const { outputText } = ts.transpileModule(readFileSync(url, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const exports = {};
  runInNewContext(outputText, {
    exports,
    require(specifier) {
      if (!Object.hasOwn(dependencies, specifier)) {
        throw new Error(`Unexpected test dependency: ${specifier}`);
      }
      return dependencies[specifier];
    },
    ...globals,
  }, { filename: url.pathname });
  return exports;
}
