import * as xml2js from 'xml2js';
import * as path from 'path';
import { log } from '@listen-fair-play/logging';
import { fileExists, getFile, saveFile, listFiles, createDirectory } from '@listen-fair-play/s3';

// Types
interface RSSFeedConfig {
  'rssFeeds': Array<{
    rssFeedFile: string;
    title: string;
    status: 'active' | 'archived';
    url: string;
    lastRetrieved: string;
  }>;
}

interface Episode {
  title: string;
  pubDate: string;
  enclosure: {
    $: {
      url: string;
      type: string;
      length: string;
    };
  };
  guid: string;
}

// Constants - Define S3 paths
const RSS_CONFIG_KEY = 'rss/rss-feeds-config.json';
const RSS_DIR_PREFIX = 'rss/';
const AUDIO_DIR_PREFIX = 'audio/';

// Helper to format date as YYYY-MM-DD
function formatDateYYYYMMDD(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Parse pubDate string to Date object
function parsePubDate(pubDate: string): Date {
  return new Date(pubDate);
}

// Get episode filename based on pubDate and title
function getEpisodeFilename(episode: Episode): string {
  const date = parsePubDate(episode.pubDate);
  const formattedDate = formatDateYYYYMMDD(date);
  // Replace invalid characters for filenames
  const sanitizedTitle = episode.title
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '-')
    .substring(0, 50); // Limit title length
  
  return `${formattedDate}_${sanitizedTitle}.mp3`;
}

// Read RSS config file
async function readRSSConfig(): Promise<RSSFeedConfig> {
  try {
    const configBuffer = await getFile(RSS_CONFIG_KEY);
    return JSON.parse(configBuffer.toString('utf-8'));
  } catch (error) {
    log.error('Error reading RSS config:', error);
    throw error;
  }
}

// Fetch RSS feed
async function fetchRSSFeed(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.text();
  } catch (error) {
    log.error(`Error fetching RSS feed from ${url}:`, error);
    throw error;
  }
}

// Parse RSS XML to JSON
async function parseRSSFeed(xmlContent: string): Promise<any> {
  const parser = new xml2js.Parser({ explicitArray: false });
  
  try {
    return await parser.parseStringPromise(xmlContent);
  } catch (error) {
    log.error('Error parsing RSS XML:', error);
    throw error;
  }
}

// Save RSS feed to file and update config
async function saveRSSFeed(
  xmlContent: string, 
  feedConfig: RSSFeedConfig['rssFeeds'][0]
): Promise<void> {
  const filePath = path.join(RSS_DIR_PREFIX, feedConfig.rssFeedFile);
  
  try {
    await saveFile(filePath, xmlContent);
    log.debug(`RSS feed saved to ${filePath}`);
    
    // Update lastRetrieved timestamp
    feedConfig.lastRetrieved = new Date().toISOString();
    
    // Update config file
    const fullConfig = await readRSSConfig();
    const feedIndex = fullConfig['rssFeeds'].findIndex(feed => feed.rssFeedFile === feedConfig.rssFeedFile);
    
    if (feedIndex !== -1) {
      fullConfig['rssFeeds'][feedIndex] = feedConfig;
      await saveFile(RSS_CONFIG_KEY, JSON.stringify(fullConfig, null, 2));
      log.debug(`Updated lastRetrieved timestamp for ${feedConfig.title}`);
    }
  } catch (error) {
    log.error(`Error saving RSS feed for ${feedConfig.title}:`, error);
    throw error;
  }
}

// Get episodes that haven't been downloaded
async function identifyNewEpisodes(
  parsedFeed: any, 
  feedConfig: RSSFeedConfig['rssFeeds'][0]
): Promise<Episode[]> {
  const episodes = parsedFeed.rss.channel.item || [];
  
  // Create podcast-specific directory path
  const podcastDir = path.basename(feedConfig.rssFeedFile, path.extname(feedConfig.rssFeedFile));
  const podcastAudioPrefix = path.join(AUDIO_DIR_PREFIX, podcastDir);
  
  // Ensure the podcast directory exists
  await createDirectory(podcastAudioPrefix);
  
  try {
    // Get existing files
    const existingFiles = await listFiles(podcastAudioPrefix);
    const existingFilenames = existingFiles.map((filePath: string) => path.basename(filePath));
    
    return episodes.filter((episode: Episode) => {
      // Skip episodes without enclosure or URL
      if (!episode.enclosure || !episode.enclosure.$ || !episode.enclosure.$.url) {
        return false;
      }
      
      const filename = getEpisodeFilename(episode);
      // Check if file doesn't exist already
      return !existingFilenames.includes(filename);
    });
  } catch (error) {
    log.error(`Error identifying new episodes for ${feedConfig.title}:`, error);
    return [];
  }
}

// Download episode audio file
async function downloadEpisodeAudio(episode: Episode, feedConfig: RSSFeedConfig['rssFeeds'][0]): Promise<string> {
  const url = episode.enclosure.$.url;
  const filename = getEpisodeFilename(episode);
  
  // Create podcast-specific directory path
  const podcastDir = path.basename(feedConfig.rssFeedFile, path.extname(feedConfig.rssFeedFile));
  const podcastAudioKey = path.join(AUDIO_DIR_PREFIX, podcastDir, filename);
  
  try {
    log.debug(`Downloading episode: ${episode.title}`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    // Save the audio file directly to S3 or local storage
    await saveFile(podcastAudioKey, Buffer.from(arrayBuffer));
    log.debug(`Successfully downloaded: ${filename}`);
    
    return podcastAudioKey;
  } catch (error) {
    log.error(`❌ Error downloading episode ${episode.title}:`, error);
    throw error;
  }
}

// Trigger Lambda-2 for transcription (placeholder for now)
async function triggerTranscriptionLambda(newAudioFiles: string[]): Promise<void> {
  log.debug('New audio files to transcribe:', newAudioFiles);
  // In AWS environment, this would use AWS SDK to trigger another Lambda
  // For local dev, we'll just log the files
  log.debug('Would trigger Lambda-2 with these files:', newAudioFiles);
}

// Main handler function
export async function handler(): Promise<void> {
  try {
    log.debug('Starting RSS feed processing at', new Date().toISOString());
    
    // Ensure directories exist
    await createDirectory(RSS_DIR_PREFIX);
    await createDirectory(AUDIO_DIR_PREFIX);
    
    // Check if config exists, if not create it with empty array
    if (!await fileExists(RSS_CONFIG_KEY)) {
      const emptyConfig = { rssFeeds: [] };
      await saveFile(RSS_CONFIG_KEY, JSON.stringify(emptyConfig, null, 2));
    }
    
    const config = await readRSSConfig();
    const activeFeeds = config['rssFeeds'].filter(feed => feed.status === 'active');
    
    log.debug(`Found ${activeFeeds.length} active feeds to process`);
    
    const newAudioFiles: string[] = [];
    
    for (const feed of activeFeeds) {
      log.debug(`Processing feed: ${feed.title}`);
      
      try {
        // Fetch RSS feed
        const xmlContent = await fetchRSSFeed(feed.url);
        
        // Save RSS feed
        await saveRSSFeed(xmlContent, feed);
        
        // Parse RSS feed
        const parsedFeed = await parseRSSFeed(xmlContent);
        
        // Identify new episodes
        const newEpisodes = await identifyNewEpisodes(parsedFeed, feed);
        
        if (newEpisodes.length === 0) {
          log.debug(`No new episodes found for ${feed.title}`);
          continue;
        }
        
        log.debug(`Found ${newEpisodes.length} new episodes for ${feed.title}`);
        
        // Download each new episode
        for (const episode of newEpisodes) {
          try {
            const audioFilePath = await downloadEpisodeAudio(episode, feed);
            newAudioFiles.push(audioFilePath);
          } catch (downloadError) {
            log.error(`❌ Failed to download episode ${episode.title}:`, downloadError);
            // Continue to next episode rather than stopping the whole process
          }
        }
      } catch (feedError) {
        log.error(`❌ Error processing feed ${feed.title}:`, feedError);
        // Continue to next feed rather than stopping the whole process
      }
    }
    
    // If new audio files were downloaded, trigger transcription
    if (newAudioFiles.length > 0) {
      log.debug(`✅ Successfully downloaded ${newAudioFiles.length} new episodes`);
      await triggerTranscriptionLambda(newAudioFiles);
    } else {
      log.debug('☑️  No new episodes were downloaded');
    }
    
    // Group new audio files by podcast
    const podcastStats = new Map<string, number>();
    for (const file of newAudioFiles) {
      const podcastName = path.basename(path.dirname(file));
      podcastStats.set(podcastName, (podcastStats.get(podcastName) || 0) + 1);
    }

    log.info('\n📊 RSS Feed Processing Summary:');
    log.info(`\n📡 Active Feeds Processed: ${activeFeeds.length}`);
    log.info(`\n🎙️  New Episodes Downloaded: ${newAudioFiles.length}`);
    
    if (newAudioFiles.length > 0) {
      log.info('\n📂 Breakdown by Podcast:');
      for (const [podcast, count] of podcastStats) {
        log.info(`\n🎧 ${podcast}:`);
        log.info(`   📥 New Episodes: ${count}`);
      }
    }
    
    log.info('\n✨ RSS feed processing completed successfully');
  } catch (error) {
    log.error('❌ Error in RSS feed processing:', error);
    throw error;
  }
}

// For local development, call the handler directly
// ES modules don't have require.main === module, so check if this is the entry point by checking import.meta.url
const scriptPath = path.resolve(process.argv[1]);
if (import.meta.url === `file://${scriptPath}`) {
  log.debug('Starting podcast RSS feed retrieval - running via pnpm...');
  handler()
    .then(() => log.debug('Processing completed successfully'))
    .catch(error => {
      log.error('Processing failed:', error);
      process.exit(1);
    });
}