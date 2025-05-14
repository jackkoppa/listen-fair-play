/**
 * These are dependencies *NOT* included in the AWS Lambda Runtime,
 * and that are also not easy to bundle via Rollup.
 * 
 * As such, we mark them as externalized,
 * and copy them into the `aws-dist` directory as `node_modules`
 */
export const EXTERNALIZED_DEPS = [
    'fluent-ffmpeg',
    'openai',
    'xml2js',
    'fs-extra'
]