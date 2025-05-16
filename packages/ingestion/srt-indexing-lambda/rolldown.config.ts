import { defineConfig } from 'rolldown';

export default defineConfig({
  input: './convert-srt-files-into-indexed-search-entries.ts',
  output: {
    dir: 'aws-dist',
  },
  platform: 'node',
  resolve: {
    symlinks: true,
  },
});