import { defineConfig } from 'rolldown';

export default defineConfig({
  input: './process-new-audio-files-via-whisper.ts',
  output: {
    dir: 'aws-dist',
  },
  platform: 'node',
  resolve: {
    symlinks: true,
  },
});