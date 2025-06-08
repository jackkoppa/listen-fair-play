#!/usr/bin/env node

const prompts = require('prompts');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.dev if it exists
function loadEnvFile() {
    const envFile = path.join(process.cwd(), '.env.dev');
    if (fs.existsSync(envFile)) {
        console.log('Loading environment variables from .env.dev...');
        const envContent = fs.readFileSync(envFile, 'utf8');
        envContent.split('\n').forEach(line => {
            const [key, value] = line.split('=');
            if (key && value) {
                process.env[key.trim()] = value.trim();
            }
        });
    } else {
        console.log('Warning: .env.dev file not found. AWS_PROFILE might not be set.');
    }
}

// Get AWS region from environment or AWS config
async function getAWSRegion() {
    return process.env.AWS_REGION || await new Promise((resolve) => {
        const awsCmd = spawn('aws', ['configure', 'get', 'region']);
        let output = '';
        awsCmd.stdout.on('data', (data) => {
            output += data.toString();
        });
        awsCmd.on('close', () => {
            resolve(output.trim() || 'us-east-1');
        });
    });
}

// Check if AWS CLI is available
function checkAWSCLI() {
    return new Promise((resolve) => {
        const which = spawn('which', ['aws']);
        which.on('close', (code) => {
            resolve(code === 0);
        });
    });
}

// Check AWS SSO authentication
async function checkAWSAuth(profile) {
    return new Promise((resolve) => {
        const stsCmd = spawn('aws', ['sts', 'get-caller-identity', '--profile', profile], {
            stdio: 'pipe'
        });
        stsCmd.on('close', (code) => {
            resolve(code === 0);
        });
    });
}

// Invoke Lambda function
async function invokeLambda(functionName, profile, region) {
    const outputFile = 'lambda_invoke_output.json';
    
    return new Promise((resolve, reject) => {
        const lambdaCmd = spawn('aws', [
            'lambda', 'invoke',
            '--function-name', functionName,
            '--cli-binary-format', 'raw-in-base64-out',
            '--payload', '{}',
            '--profile', profile,
            '--region', region,
            outputFile
        ]);

        lambdaCmd.on('close', (code) => {
            if (code === 0) {
                console.log('✅ Lambda function invoked successfully.');
                console.log(`Output (and any errors from the Lambda execution) saved to: ${outputFile}`);
                console.log('---------------------------------------------------------------------');
                console.log(`Quick view of the output (from ${outputFile}):`);
                
                try {
                    const output = fs.readFileSync(outputFile, 'utf8');
                    console.log(output);
                    console.log('');
                    console.log('---------------------------------------------------------------------');
                    
                    // Check for errors within the Lambda's response
                    if (output.includes('errorMessage')) {
                        console.log('⚠️  NOTE: The Lambda function was invoked, but its execution might have resulted in an error.');
                        console.log(`   Please check the contents of '${outputFile}' for details like 'errorMessage' or 'errorType'.`);
                    }
                } catch (err) {
                    console.log('Could not read output file:', err.message);
                }
                
                resolve();
            } else {
                console.log('❌ Lambda function invocation command failed.');
                console.log(`   Check the AWS CLI error output above. If it mentions credentials, ensure your SSO session for profile '${profile}' is active.`);
                console.log(`   Output from the failed command (if any) is in ${outputFile}.`);
                reject(new Error('Lambda invocation failed'));
            }
        });

        lambdaCmd.stderr.on('data', (data) => {
            console.error(data.toString());
        });
    });
}

async function main() {
    try {
        // Load environment variables
        loadEnvFile();

        // Configuration
        const awsRegion = await getAWSRegion();
        
        // Define available Lambda functions
        const lambdaFunctions = [
            {
                title: 'RSS Feed Retrieval and Audio Download',
                value: 'retrieve-rss-feeds-and-download-audio-files'
            },
            {
                title: 'Whisper Audio Processing',
                value: 'process-new-audio-files-via-whisper'
            },
            {
                title: 'SRT to Search Index Conversion',
                value: 'convert-srt-files-into-indexed-search-entries'
            }
        ];

        // Check if AWS CLI is installed
        if (!(await checkAWSCLI())) {
            console.log('❌ AWS CLI could not be found. Please install and configure it.');
            process.exit(1);
        }

        // Check AWS SSO authentication
        if (!process.env.AWS_PROFILE) {
            console.log('❌ AWS_PROFILE is not set. Please ensure it\'s defined in your .env.dev file or environment.');
            console.log('  Example .env.dev entry: AWS_PROFILE=your_profile_name');
            console.log('  If you haven\'t configured an SSO profile, run \'aws configure sso\'.');
            process.exit(1);
        }

        console.log(`Attempting to use AWS Profile: ${process.env.AWS_PROFILE}`);
        
        if (!(await checkAWSAuth(process.env.AWS_PROFILE))) {
            console.log(`❌ AWS SSO credentials are not working or expired for profile: ${process.env.AWS_PROFILE}.`);
            console.log(`  Please run 'aws sso login --profile ${process.env.AWS_PROFILE}' to authenticate.`);
            process.exit(1);
        }

        console.log(`✅ AWS SSO authentication verified with profile: ${process.env.AWS_PROFILE}`);

        // Use prompts to get user selection
        const response = await prompts({
            type: 'select',
            name: 'lambdaFunction',
            message: 'Please select which Lambda function to trigger:',
            choices: lambdaFunctions,
            initial: 0
        });

        // Handle if user cancels the prompt
        if (!response.lambdaFunction) {
            console.log('Exiting...');
            process.exit(0);
        }

        const selectedFunction = response.lambdaFunction;
        console.log(`Attempting to invoke Lambda function: ${selectedFunction} in region: ${awsRegion} using profile: ${process.env.AWS_PROFILE}...`);

        // Invoke the Lambda function
        await invokeLambda(selectedFunction, process.env.AWS_PROFILE, awsRegion);

    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
    console.log('\nExiting...');
    process.exit(0);
});

main(); 