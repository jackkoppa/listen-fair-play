import { useParams, useSearchParams } from 'react-router'
import { useState, useEffect } from 'react'
import { log } from '@listen-fair-play/logging'
import { EpisodeInManifest, EpisodeManifest, ApiSearchResultHit } from '@listen-fair-play/types'
import { S3_HOSTED_FILES_BASE_URL } from '../constants'
import EpisodeDetailsSheet from '../components/EpisodeDetailsSheet'

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
  const startTime = searchParams.get('start')
  
  const [episodeData, setEpisodeData] = useState<EpisodeInManifest | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  // Create a mock search result for transcript highlighting
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

  if (isLoading) {
    return <div>Loading episode...</div>
  }

  if (error) {
    return <div>Error: {error}</div>
  }

  if (!episodeData) {
    return <div>Episode not found</div>
  }

  const mockSearchResult = createMockSearchResult()
  if (!mockSearchResult) {
    return <div>Invalid start time parameter</div>
  }

  return (
    <EpisodeDetailsSheet 
      episodeData={episodeData}
      originalSearchResult={mockSearchResult}
    />
  )
} 