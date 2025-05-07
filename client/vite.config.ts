import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import fs from 'fs'
import path from 'path'
import type { ViteDevServer } from 'vite'
import type { IncomingMessage, ServerResponse } from 'http'
import { log } from './src/utils/logging.js'

// Define a custom plugin to serve transcript files
function transcriptServerPlugin() {
  return {
    name: 'transcript-server-plugin',
    configureServer(server: ViteDevServer) {
      // Handler for listing transcript files
      server.middlewares.use('/api/transcript-files', (_req: IncomingMessage, res: ServerResponse) => {
        try {
          // Get all .srt files from processing/transcripts
          const rootDir = path.resolve(__dirname, '..');
          const transcriptsDir = path.join(rootDir, 'processing', 'transcripts');
          const files = findSrtFiles(transcriptsDir);
          
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ files: files.map(f => path.basename(f)) }));
        } catch (error) {
          log.error('Error serving transcript-files:', error);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'Failed to read transcript files' }));
        }
      });

      // Handler for serving transcript content
      server.middlewares.use('/api/transcripts', (req: IncomingMessage, res: ServerResponse) => {
        try {
          const rootDir = path.resolve(__dirname, '..');
          const transcriptsDir = path.join(rootDir, 'processing', 'transcripts');
          const requestedFile = req.url?.substring(1); // Remove leading slash
          
          if (!requestedFile) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'No file specified' }));
            return;
          }
          
          // Find the file in any subdirectory of processing/transcripts
          const files = findSrtFiles(transcriptsDir);
          const matchingFile = files.find(f => path.basename(f) === requestedFile);
          
          if (!matchingFile) {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'File not found' }));
            return;
          }
          
          const fileContent = fs.readFileSync(matchingFile, 'utf-8');
          res.setHeader('Content-Type', 'text/plain');
          res.end(fileContent);
        } catch (error) {
          log.error('Error serving transcript file:', error);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'Failed to read transcript file' }));
        }
      });
    }
  };
}

// Helper function to find all .srt files in a directory and its subdirectories
function findSrtFiles(dir: string): string[] {
  let results: string[] = [];
  
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      // Recurse into subdirectories, excluding node_modules
      if (item !== 'node_modules') {
        results = results.concat(findSrtFiles(fullPath));
      }
    } else if (item.endsWith('.srt')) {
      results.push(fullPath);
    }
  }
  
  return results;
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    transcriptServerPlugin()
  ],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  }
})
