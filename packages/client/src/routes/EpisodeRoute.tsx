import { useParams, useSearchParams, useNavigate } from 'react-router'
import { useState, useEffect, useRef } from 'react'
import { log } from '@listen-fair-play/logging'
import { EpisodeInManifest, EpisodeManifest } from '@listen-fair-play/types'
import { S3_HOSTED_FILES_BASE_URL } from '../constants'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../components/ui/sheet'
import { CaretSortIcon, MinusCircledIcon } from "@radix-ui/react-icons"
import { Badge } from "../components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover"
import AudioPlayer, { AudioPlayerRef } from "../components/AudioPlayer/AudioPlayer"
import { formatDate } from '@/utils/date'
import { formatMillisecondsToMMSS } from '@/utils/time'

// Import the FullEpisodeTranscript component from EpisodeDetailsSheet
import { SearchEntry } from '@listen-fair-play/types'

async function getFullEpisodeSearchEntryFile(fileKey: string, podcastId: string): Promise<SearchEntry[]> {
  const response = await fetch(`${S3_HOSTED_FILES_BASE_URL}search-entries/${podcastId}/${fileKey}.json`);
  const data = await response.json();
  return data;
}

/** 
 * Buffer to allow for matching current audio playback time to a search entry
 * required so that when clicking on a search entry, the correct entry is highlighted (rather than previous one)
 */
const ENTRY_MATCHING_THRESHOLD_MS = 500

function FullEpisodeTranscript({
  episodeData,
  startTimeMs,
  currentPlayingTimeMs,
  onEntryClick
}: {
  episodeData: EpisodeInManifest;
  startTimeMs: number | null;
  currentPlayingTimeMs: number | null;
  onEntryClick: (entry: SearchEntry) => void;
}) {
  const [searchEntries, setSearchEntries] = useState<SearchEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [urlBasedTargetEntryId, setUrlBasedTargetEntryId] = useState<string | null>(null);
  const [currentPlayingEntryId, setCurrentPlayingEntryId] = useState<string | null>(null);
  const urlBasedEntryRef = useRef<HTMLDivElement>(null);
  const currentPlayingEntryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getFullEpisodeSearchEntryFile(episodeData.fileKey, episodeData.podcastId).then(setSearchEntries);
    setIsLoading(false);
  }, [episodeData]);

  // Find the URL-based target entry to highlight and scroll to (only on initial load)
  useEffect(() => {
    if (!isLoading && searchEntries.length > 0 && startTimeMs && !urlBasedTargetEntryId) {
      // Find the first entry with start time >= the requested start time
      const targetEntry = searchEntries.find(entry =>
        entry.startTimeMs >= (startTimeMs - ENTRY_MATCHING_THRESHOLD_MS)
      );

      if (targetEntry) {
        setUrlBasedTargetEntryId(targetEntry.id);
      } else {
        // If no entry found with start time >= requested time, use the last entry
        const lastEntry = searchEntries[searchEntries.length - 1];
        setUrlBasedTargetEntryId(lastEntry?.id || null);
      }
    }
  }, [isLoading, searchEntries, startTimeMs, urlBasedTargetEntryId]);

  // Find the currently playing entry based on audio playback time
  useEffect(() => {
    if (!isLoading && searchEntries.length > 0 && currentPlayingTimeMs !== null) {
      // Find the entry that contains the current playback time
      const playingEntry = searchEntries.find(entry =>
        currentPlayingTimeMs >= (entry.startTimeMs - ENTRY_MATCHING_THRESHOLD_MS) && currentPlayingTimeMs <= (entry.endTimeMs - ENTRY_MATCHING_THRESHOLD_MS)
      );

      if (playingEntry && playingEntry.id !== currentPlayingEntryId) {
        setCurrentPlayingEntryId(playingEntry.id);
      }
    }
  }, [isLoading, searchEntries, currentPlayingTimeMs, currentPlayingEntryId]);

  // Scroll to the URL-based target entry when it's identified (initial load only)
  useEffect(() => {
    if (!isLoading && searchEntries.length > 0 && urlBasedTargetEntryId && urlBasedEntryRef.current) {
      urlBasedEntryRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [isLoading, searchEntries, urlBasedTargetEntryId]);

  // Scroll to the currently playing entry when it changes (during playback)
  useEffect(() => {
    if (!isLoading && searchEntries.length > 0 && currentPlayingEntryId && currentPlayingEntryRef.current) {
      // Only scroll if the currently playing entry is different from the URL-based target
      if (currentPlayingEntryId !== urlBasedTargetEntryId) {
        currentPlayingEntryRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
    }
  }, [isLoading, searchEntries, currentPlayingEntryId, urlBasedTargetEntryId]);

  function isUrlBasedTarget(entry: SearchEntry) {
    return urlBasedTargetEntryId === entry.id;
  }

  function isCurrentlyPlaying(entry: SearchEntry) {
    return currentPlayingEntryId === entry.id;
  }

  function getEntryClassName(entry: SearchEntry) {
    const baseClass = 'py-2 px-4';

    if (isUrlBasedTarget(entry)) {
      return baseClass + ' bg-yellow-100 border-l-4 border-yellow-500 font-bold';
    } else if (isCurrentlyPlaying(entry)) {
      return baseClass + ' bg-blue-100 border-l-4 border-blue-500 font-semibold';
    } else {
      return baseClass + ' text-muted-foreground hover:bg-gray-100 cursor-pointer';
    }
  }

  function getEntryRef(entry: SearchEntry) {
    if (isCurrentlyPlaying(entry)) {
      return currentPlayingEntryRef;
    } else if (isUrlBasedTarget(entry)) {
      return urlBasedEntryRef;
    }
    return null;
  }

  return (
    <div>
      {isLoading && null}
      {!isLoading && searchEntries.length === 0 && <p>Episode transcript not available. Please try refreshing the page.</p>}
      {!isLoading && searchEntries.length > 0 && (
        <div>
          {searchEntries.map((entry) => (
            <div
              key={entry.id}
              ref={getEntryRef(entry)}
              className={getEntryClassName(entry)}
              onClick={() => onEntryClick(entry)}
            >
              <Badge variant="outline" className="my-1"><em>{formatMillisecondsToMMSS(entry.startTimeMs)} - {formatMillisecondsToMMSS(entry.endTimeMs)}</em></Badge>
              <p>{entry.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * EpisodeRoute component that handles the /episode/:eID route.
 * 
 * Reads:
 * - eID route parameter (episode sequential ID)
 * - start query parameter (start time in milliseconds)
 * 
 * Fetches episode data and creates a mock search result for transcript highlighting.
 * Renders EpisodeDetailsSheet as an overlay while preserving the Sheet component behavior.
 */
export default function EpisodeRoute() {
  const { eID } = useParams<{ eID: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const startTime = searchParams.get('start')
  const startTimeMs = startTime ? Number(startTime) : null

  const [episodeData, setEpisodeData] = useState<EpisodeInManifest | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDescriptionOpen, setIsDescriptionOpen] = useState(false)
  const [currentPlayingTimeMs, setCurrentPlayingTimeMs] = useState<number | null>(null)
  const [hasUserInteracted, setHasUserInteracted] = useState(false)

  const audioPlayerRef = useRef<AudioPlayerRef>(null)

  useEffect(() => {
    const fetchEpisodeData = async () => {
      if (!eID) {
        setError('Episode ID is required')
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        setError(null)

        // Fetch episode manifest to find the episode by sequential ID
        const manifestPath = `${S3_HOSTED_FILES_BASE_URL}episode-manifest/full-episode-manifest.json`
        const response = await fetch(manifestPath)

        if (!response.ok) {
          throw new Error(`Failed to fetch episode manifest: ${response.status}`)
        }

        const manifestData: EpisodeManifest = await response.json()

        // Find episode by sequential ID (converted to number for comparison)
        const episode = manifestData.episodes.find(ep => ep.sequentialId === parseInt(eID, 10))

        if (!episode) {
          throw new Error(`Episode with ID ${eID} not found`)
        }

        setEpisodeData(episode)
      } catch (e: any) {
        log.error('[EpisodeRoute.tsx] Failed to fetch episode data:', e)
        setError(e.message || 'Failed to load episode data')
      } finally {
        setIsLoading(false)
      }
    }

    fetchEpisodeData()
  }, [eID])



  // Handle sheet close - navigate back to home while preserving search query params
  const handleSheetClose = () => {
    const currentParams = new URLSearchParams(searchParams)
    // Remove episode-specific params
    currentParams.delete('start')

    // Navigate back to home with preserved search params
    const queryString = currentParams.toString()
    navigate(queryString ? `/?${queryString}` : '/')
  }

  const handleListen = (currentTimeMs: number) => {
    // Only track current playing time if user has interacted with the audio
    if (hasUserInteracted) {
      setCurrentPlayingTimeMs(currentTimeMs);
    }
  }

  const handlePlay = () => {
    // Mark that user has interacted with the audio
    setHasUserInteracted(true);
  }

  const handleEntryClick = (entry: SearchEntry) => {
    // Mark that user has interacted with the audio
    setHasUserInteracted(true);
    // Seek the audio player to the entry's start time
    if (audioPlayerRef.current) {
      audioPlayerRef.current.seekTo(entry.startTimeMs);
    }
  }

  // Show loading state
  if (isLoading) {
    return (
      <Sheet open={true} onOpenChange={handleSheetClose}>
        <SheetContent className="font-mono overflow-y-auto w-[350px]">
          <div className="flex items-center justify-center h-32">
            <p>Loading episode...</p>
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  // Show error state
  if (error || !episodeData) {
    return (
      <Sheet open={true} onOpenChange={handleSheetClose}>
        <SheetContent className="font-mono overflow-y-auto w-[350px]">
          <div className="flex items-center justify-center h-32">
            <div className="text-center">
              <p className="text-red-600 mb-2">Error loading episode</p>
              <p className="text-sm text-muted-foreground">{error || 'Episode not found'}</p>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  const { title, summary, publishedAt } = episodeData
  const formattedPublishedAt = publishedAt ? formatDate(publishedAt) : null


  /**
   * Potential future enhancement: allow users to toggle between the original (RSS-feed-provided) .mp3,
   * and the audio used to generate the transcript.
   * For now: always load the .mp3 used to generate the transcript, to guarantee timestamps match up correctly.
   */
  const baseAudioUrl = `${S3_HOSTED_FILES_BASE_URL}audio/${episodeData.podcastId}/${episodeData.fileKey}.mp3`
  /** Create audio URL with start time if available */
  const audioUrlToLoad = startTimeMs ? `${baseAudioUrl}#t=${formatMillisecondsToMMSS(startTimeMs)}` : baseAudioUrl

  return (
    <Sheet open={true} onOpenChange={handleSheetClose}>
      <SheetContent className="font-mono overflow-y-auto w-[90%] md:w-140 lg:w-180 max-w-[90%] md:max-w-140 lg:max-w-180">
        <SheetHeader className="sticky top-0 bg-gradient-to-b from-white from-85% to-transparent pb-4">
          <div className="flex flex-row gap-2">
            <Badge variant="destructive">{formattedPublishedAt}</Badge>
            <Popover onOpenChange={setIsDescriptionOpen}>
              <PopoverTrigger className="relative cursor-pointer">
                <Badge variant="outline" className="absolute top-0 left-0 hover:bg-accent hover:text-accent-foreground">
                  Summary
                  {isDescriptionOpen ? <MinusCircledIcon /> : <CaretSortIcon />}
                </Badge>
              </PopoverTrigger>
              <PopoverContent align="center" side="bottom" className="text-sm"><em>{summary}</em></PopoverContent>
            </Popover>
          </div>
          <SheetTitle className="text-lg/6 font-semibold mt-2 mb-2">
            {title}
          </SheetTitle>
          <div>
            <AudioPlayer
              ref={audioPlayerRef}
              src={audioUrlToLoad}
              className="mb-4"
              onListen={handleListen}
              onPlay={handlePlay}
            />
          </div>
          <SheetDescription>
          </SheetDescription>
        </SheetHeader>
        <FullEpisodeTranscript
          episodeData={episodeData}
          startTimeMs={startTimeMs}
          currentPlayingTimeMs={hasUserInteracted ? currentPlayingTimeMs : null}
          onEntryClick={handleEntryClick}
        />
      </SheetContent>
    </Sheet>
  )
} 