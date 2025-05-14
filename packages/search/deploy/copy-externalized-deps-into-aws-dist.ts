import { EXTERNALIZED_DEPS } from './externalized-deps';
import { join } from 'path';
import { cpSync, readdirSync, existsSync } from 'fs';
import fs from 'fs-extra';

// Copy externalized dependencies into each lambda directory
const lambdaDirs = readdirSync(join(process.cwd(), 'aws-dist')).filter(dir => dir.startsWith('lambda-'));

for (const lambdaDir of lambdaDirs) {
    // Create node_modules directory for each lambda if it doesn't exist
    const nodeModulesPath = join(process.cwd(), 'aws-dist', lambdaDir, 'node_modules');
    fs.ensureDirSync(nodeModulesPath);
    
    // Copy each externalized dependency
    for (const dep of EXTERNALIZED_DEPS) {
        const sourcePath = join(process.cwd(), 'node_modules', dep);
        const targetPath = join(nodeModulesPath, dep);
        if (!existsSync(targetPath)) {
            cpSync(sourcePath, targetPath, { recursive: true });
        }
    }
}