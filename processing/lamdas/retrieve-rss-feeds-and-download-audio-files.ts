import axios from 'axios';
import * as xml2js from 'xml2js';
import * as fs from 'fs-extra';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ES Module dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Constants
const RSS_CONFIG_PATH = path.join(__dirname, '../rss/rss-feeds-config.json');
const RSS_DIR = path.join(__dirname, '../rss');
const AUDIO_DIR = path.join(__dirname, '../audio');

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
    const configContent = await fs.readFile(RSS_CONFIG_PATH, 'utf-8');
    return JSON.parse(configContent);
  } catch (error) {
    console.error('Error reading RSS config:', error);
    throw error;
  }
}

// Fetch RSS feed
async function fetchRSSFeed(url: string): Promise<string> {
  try {
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error(`Error fetching RSS feed from ${url}:`, error);
    throw error;
  }
}

// Parse RSS XML to JSON
async function parseRSSFeed(xmlContent: string): Promise<any> {
  const parser = new xml2js.Parser({ explicitArray: false });
  
  try {
    return await parser.parseStringPromise(xmlContent);
  } catch (error) {
    console.error('Error parsing RSS XML:', error);
    throw error;
  }
}

// Save RSS feed to file and update config
async function saveRSSFeed(
  xmlContent: string, 
  feedConfig: RSSFeedConfig['rssFeeds'][0]
): Promise<void> {
  const filePath = path.join(RSS_DIR, feedConfig.rssFeedFile);
  
  try {
    await fs.writeFile(filePath, xmlContent);
    console.log(`RSS feed saved to ${filePath}`);
    
    // Update lastRetrieved timestamp
    feedConfig.lastRetrieved = new Date().toISOString();
    
    // Update config file
    const fullConfig = await readRSSConfig();
    const feedIndex = fullConfig['rssFeeds'].findIndex(feed => feed.rssFeedFile === feedConfig.rssFeedFile);
    
    if (feedIndex !== -1) {
      fullConfig['rssFeeds'][feedIndex] = feedConfig;
      await fs.writeFile(RSS_CONFIG_PATH, JSON.stringify(fullConfig, null, 2));
      console.log(`Updated lastRetrieved timestamp for ${feedConfig.title}`);
    }
  } catch (error) {
    console.error(`Error saving RSS feed for ${feedConfig.title}:`, error);
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
  const podcastAudioDir = path.join(AUDIO_DIR, podcastDir);
  
  // Ensure the podcast-specific directory exists
  await fs.ensureDir(podcastAudioDir);
  
  const existingFiles = await fs.readdir(podcastAudioDir);
  
  return episodes.filter((episode: Episode) => {
    // Skip episodes without enclosure or URL
    if (!episode.enclosure || !episode.enclosure.$ || !episode.enclosure.$.url) {
      return false;
    }
    
    const filename = getEpisodeFilename(episode);
    // Check if file doesn't exist already
    return !existingFiles.includes(filename);
  });
}

// Download episode audio file
async function downloadEpisodeAudio(episode: Episode, feedConfig: RSSFeedConfig['rssFeeds'][0]): Promise<string> {
  const url = episode.enclosure.$.url;
  const filename = getEpisodeFilename(episode);
  
  // Create podcast-specific directory path
  const podcastDir = path.basename(feedConfig.rssFeedFile, path.extname(feedConfig.rssFeedFile));
  const podcastAudioDir = path.join(AUDIO_DIR, podcastDir);
  
  const filePath = path.join(podcastAudioDir, filename);
  
  try {
    console.log(`Downloading episode: ${episode.title}`);
    const response = await axios({
      method: 'GET',
      url,
      responseType: 'stream'
    });
    
    const totalLength = parseInt(response.headers['content-length'], 10);
    let downloadedLength = 0;
    let lastLogPercentage = 0;
    
    response.data.on('data', (chunk: Buffer) => {
      downloadedLength += chunk.length;
      const percentage = Math.floor((downloadedLength / totalLength) * 100);
      
      // Log progress every 10%
      if (percentage >= lastLogPercentage + 10) {
        console.log(`Download progress for ${filename}: ${percentage}%`);
        lastLogPercentage = percentage;
      }
    });
    
    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);
    
    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        console.log(`Successfully downloaded: ${filename}`);
        resolve(filePath);
      });
      
      writer.on('error', (err: Error) => {
        fs.unlink(filePath, () => {}); // Delete the file on error, ignore potential deletion errors
        console.error(`Error writing file ${filename}:`, err);
        reject(err);
      });
      
      response.data.on('error', (err: Error) => {
        fs.unlink(filePath, () => {}); // Delete the file on error, ignore potential deletion errors
        console.error(`Error in download stream for ${filename}:`, err);
        reject(err);
      });
    });
  } catch (error) {
    console.error(`Error downloading episode ${episode.title}:`, error);
    throw error;
  }
}

// Trigger Lambda-2 for transcription (placeholder for now)
async function triggerTranscriptionLambda(newAudioFiles: string[]): Promise<void> {
  console.log('New audio files to transcribe:', newAudioFiles);
  // In AWS environment, this would use AWS SDK to trigger another Lambda
  // For local dev, we'll just log the files
  console.log('Would trigger Lambda-2 with these files:', newAudioFiles);
}

// Main handler function
export async function handler(): Promise<void> {
  try {
    console.log('Starting RSS feed processing at', new Date().toISOString());
    
    // Ensure directories exist
    await fs.ensureDir(RSS_DIR);
    await fs.ensureDir(AUDIO_DIR);
    
    const config = await readRSSConfig();
    const activeFeeds = config['rssFeeds'].filter(feed => feed.status === 'active');
    
    console.log(`Found ${activeFeeds.length} active feeds to process`);
    
    const newAudioFiles: string[] = [];
    
    for (const feed of activeFeeds) {
      console.log(`Processing feed: ${feed.title}`);
      
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
          console.log(`No new episodes found for ${feed.title}`);
          continue;
        }
        
        console.log(`Found ${newEpisodes.length} new episodes for ${feed.title}`);
        
        // Download each new episode
        for (const episode of newEpisodes) {
          try {
            const audioFilePath = await downloadEpisodeAudio(episode, feed);
            newAudioFiles.push(audioFilePath);
          } catch (downloadError) {
            console.error(`Failed to download episode ${episode.title}:`, downloadError);
            // Continue to next episode rather than stopping the whole process
          }
        }
      } catch (feedError) {
        console.error(`Error processing feed ${feed.title}:`, feedError);
        // Continue to next feed rather than stopping the whole process
      }
    }
    
    // If new audio files were downloaded, trigger transcription
    if (newAudioFiles.length > 0) {
      console.log(`Successfully downloaded ${newAudioFiles.length} new episodes`);
      await triggerTranscriptionLambda(newAudioFiles);
    } else {
      console.log('No new episodes were downloaded');
    }
    
    console.log('Finished processing RSS feeds at', new Date().toISOString());
  } catch (error) {
    console.error('Error in RSS feed processing:', error);
    throw error;
  }
}

// For local development, call the handler directly
if (require.main === module) {
  console.log('Starting podcast RSS feed retrieval - running via pnpm...');
  handler()
    .then(() => console.log('Processing completed successfully'))
    .catch(error => {
      console.error('Processing failed:', error);
      process.exit(1);
    });
} 