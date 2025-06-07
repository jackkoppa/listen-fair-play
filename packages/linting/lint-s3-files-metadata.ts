/**
 * Lint files (locally or in AWS S3)
 * 
 * @param applyFixes - whether to apply fixes. If false, will just log the issues, and return an error
 */
export function lintS3Files(applyFixes: boolean = false) {
  // TODO: Implement

/* 

NOTES on implementation:
1. Find all episodes in the RSS feed(s) first. Iterate through all of them, and check what: 

 *  - Whether all episodes in the RSS feed are present in S3, including for each episode:
 *    - A .mp3 file in the `audio/` directory
 *    - A .srt file in the `transcripts/` directory
 *    - A .json file in the `search-entries/` directory
 *    - An item in the `episdoe-manifest/full-episode-manifest.json` array
 *  - Whether the file names are valid
 *    - For each file listed above, the file name is valid UTF-8 (NFC)
 *    - The file name **exactly** matches the expected output of `getEpisodeFileKey`
 *      (and if no matching file is found, check whether there is a file that, 
 *       when normalized to NFC, matches the expected output of `getEpisodeFileKey` - if so, that needs to return an error so it can be fixed)

2. Then also find all file names in the S3 bucket, and if they haven't already been confirmed during the loops in step 1,
check whether they should be removed (answer: likely yes)


*/

}

