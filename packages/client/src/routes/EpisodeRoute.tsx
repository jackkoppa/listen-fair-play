import { useParams, useSearchParams, useNavigate } from 'react-router'
import { useState, useEffect, useRef } from 'react'
import { log } from '@listen-fair-play/logging'
import { EpisodeInManifest, EpisodeManifest, ApiSearchResultHit } from '@listen-fair-play/types'
import { S3_HOSTED_FILES_BASE_URL } from '../constants'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../components/ui/sheet'
import { CaretSortIcon, MinusCircledIcon } from "@radix-ui/react-icons"
import { Badge } from "../components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover"
import AudioPlayer from "../components/AudioPlayer/AudioPlayer"
import { formatDate } from '@/utils/date'
import { formatMillisecondsToMMSS } from '@/utils/time'

// Import the FullEpisodeTranscript component from EpisodeDetailsSheet
import { SearchEntry } from '@listen-fair-play/types'

async function getFullEpisodeSearchEntryFile(fileKey: string, podcastId: string): Promise<SearchEntry[]> {
    const response = await fetch(`${S3_HOSTED_FILES_BASE_URL}search-entries/${podcastId}/${fileKey}.json`);
    const data = await response.json();
    return data;
}

function FullEpisodeTranscript({ episodeData, originalSearchResult }: {
    episodeData: EpisodeInManifest;
    originalSearchResult: ApiSearchResultHit | null;
}) {
    const [searchEntries, setSearchEntries] = useState<SearchEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [targetEntryId, setTargetEntryId] = useState<string | null>(null);
    const selectedEntryRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        getFullEpisodeSearchEntryFile(episodeData.fileKey, episodeData.podcastId).then(setSearchEntries);
        setIsLoading(false);
    }, [episodeData]);

    // Find the target entry to highlight and scroll to
    useEffect(() => {
        if (!isLoading && searchEntries.length > 0 && originalSearchResult) {
            // Find the first entry with start time >= the requested start time
            const targetEntry = searchEntries.find(entry => 
                entry.startTimeMs >= originalSearchResult.startTimeMs
            );
            
            if (targetEntry) {
                setTargetEntryId(targetEntry.id);
            } else {
                // If no entry found with start time >= requested time, use the last entry
                const lastEntry = searchEntries[searchEntries.length - 1];
                setTargetEntryId(lastEntry?.id || null);
            }
        } else if (originalSearchResult && originalSearchResult.id && !originalSearchResult.id.startsWith('mock-')) {
            // For real search results (not mock), use the original ID
            setTargetEntryId(originalSearchResult.id);
        }
    }, [isLoading, searchEntries, originalSearchResult]);

    // Scroll to the target entry when it's identified
    useEffect(() => {
        if (!isLoading && searchEntries.length > 0 && targetEntryId && selectedEntryRef.current) {
            selectedEntryRef.current.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }
    }, [isLoading, searchEntries, targetEntryId]);

    function isCurrentlySelected(entry: SearchEntry) {
        return targetEntryId === entry.id;
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
                        ref={isCurrentlySelected(entry) ? selectedEntryRef : null}
                        className={'py-2 px-4' + (isCurrentlySelected(entry) ? ' bg-yellow-100 font-bold' : ' text-muted-foreground')}
                    >
                        <Badge variant="outline" className="my-1"><em>{formatMillisecondsToMMSS(entry.startTimeMs)} - {formatMillisecondsToMMSS(entry.endTimeMs)}</em></Badge>
                        <p>{entry.text}</p>
                    </div>
                ))  }
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
  
  const [episodeData, setEpisodeData] = useState<EpisodeInManifest | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDescriptionOpen, setIsDescriptionOpen] = useState(false)

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

  // Create a mock search result for transcript highlighting (only if start time is provided)
  const createMockSearchResult = (): ApiSearchResultHit | null => {
    if (!episodeData || !startTime) return null

    const startTimeMs = parseInt(startTime, 10)
    if (isNaN(startTimeMs)) return null

    // Create a mock search result that matches the expected structure
    return {
      id: `mock-${episodeData.sequentialId}-${startTimeMs}`,
      text: '', // Will be populated when the full transcript loads
      startTimeMs,
      endTimeMs: startTimeMs + 1000, // Default 1 second duration
      sequentialEpisodeIdAsString: eID!,
      episodePublishedUnixTimestamp: new Date(episodeData.publishedAt).getTime()
    }
  }

  // Handle sheet close - navigate back to home while preserving search query params
  const handleSheetClose = () => {
    const currentParams = new URLSearchParams(searchParams)
    // Remove episode-specific params
    currentParams.delete('start')
    
    // Navigate back to home with preserved search params
    const queryString = currentParams.toString()
    navigate(queryString ? `/?${queryString}` : '/')
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

  const mockSearchResult = createMockSearchResult()
  const { title, summary, publishedAt, originalAudioURL } = episodeData
  const formattedPublishedAt = publishedAt ? formatDate(publishedAt) : null

  // Create audio URL with start time if available
  const audioUrlToLoad = mockSearchResult 
    ? `${originalAudioURL}#t=${formatMillisecondsToMMSS(mockSearchResult.startTimeMs)}`
    : originalAudioURL

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
              src={audioUrlToLoad}
              className="mb-4"
            />
          </div>
          <SheetDescription>
          </SheetDescription>
        </SheetHeader>
        <FullEpisodeTranscript episodeData={episodeData} originalSearchResult={mockSearchResult} />
      </SheetContent>
    </Sheet>
  )
} 