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
    // Orama dependencies will be bundled with the Lambda function
  ]
});