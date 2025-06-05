// rollup.config.js
import { babel } from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import pkg from './package.json' assert { type: 'json' };

const input = 'src/index.js';

const external = [
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.peerDependencies || {}),
];

const babelOptions = {
  babelHelpers: 'bundled',
  exclude: 'node_modules/**',
};

export default [
  // ES Module (ESM) build
  {
    input,
    output: {
      file: pkg.module,
      format: 'es',
      sourcemap: true,
      name: 'Clarus',
    },
    plugins: [
      resolve(),
      commonjs(),
      babel(babelOptions),
    ],
    external,
  },

  // CommonJS (CJS) build
  {
    input,
    output: {
      file: pkg.main,
      format: 'cjs',
      exports: 'named',
      sourcemap: true,
      name: 'Clarus',
    },
    plugins: [
      resolve(),
      commonjs(),
      babel(babelOptions),
    ],
    external,
  },

  // UMD (Universal Module Definition) build
  {
    input,
    output: {
      file: pkg.browser || 'dist/clarus.umd.js',
      format: 'umd',
      name: 'Clarus',
      sourcemap: true,
      globals: {}
    },
    plugins: [
      resolve(),
      commonjs(),
      babel(babelOptions),
    ],
    external,
  },
];