import { defineConfig } from 'rolldown';

export default defineConfig({
  input: './search-indexed-transcripts.ts',
  output: {
    dir: 'aws-dist',
  },
  platform: 'node',
  resolve: {
    symlinks: true,
  },
  external: [
    'sqlite3', // provided by the sqlite3 Lambda Layer, see terraform/lambda-layers/README.md
  ]
});