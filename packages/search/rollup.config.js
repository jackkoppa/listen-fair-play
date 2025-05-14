import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
// import terser from '@rollup/plugin-terser'; // For minification

import { EXTERNALIZED_DEPS } from './deploy/externalized-deps.js';

const plugins = [
  typescript({ tsconfig: './tsconfig.json', outDir: 'aws-dist' }),
  json(),
  resolve({ preferBuiltins: true }),
  commonjs(),
  // terser(), // Enable for minification
]

// Included in AWS Lambda Runtime
// Details: https://docs.aws.amazon.com/lambda/latest/dg/lambda-nodejs.html#nodejs-sdk-included
const depsIncludedInLambdaRuntime = [
  '@aws-sdk/client-s3', 
  '@aws-sdk/credential-provider-sso', 
  '@aws-sdk/s3-request-presigner',
];

const external = [
  ...depsIncludedInLambdaRuntime,
  ...EXTERNALIZED_DEPS,
];

export default [
  {
    input: 'lambda-4/search-indexed-transcripts.ts',
    output: {
      file: 'aws-dist/lambda-4/search-indexed-transcripts.cjs',
      format: 'cjs',
      sourcemap: true,
    },
    plugins,
    external,
  }
]; 