import { defineConfig } from 'rolldown';

export default defineConfig({
  input: './retrieve-rss-feeds-and-download-audio-files.ts',
  output: {
    file: 'aws-dist/retrieve-rss-feeds-and-download-audio-files.js',
  },
  platform: 'node',
  resolve: {
    symlinks: true,
  },
});