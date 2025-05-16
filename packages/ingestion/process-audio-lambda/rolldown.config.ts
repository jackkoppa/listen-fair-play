import { defineConfig } from 'rolldown';

export default defineConfig({
  input: './process-new-audio-files-via-whisper.ts',
  output: {
    file: 'aws-dist/process-new-audio-files-via-whisper.js',
  },
  platform: 'node',
  resolve: {
    symlinks: true,
  },
});