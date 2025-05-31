import { useState, useEffect } from 'react'
import { EpisodeManifest } from '@listen-fair-play/types'
import { S3_HOSTED_FILES_BASE_URL } from '../constants'
import { log } from '../utils/logging'

interface UseEpisodeManifestReturn {
  episodeManifest: EpisodeManifest | null
  isLoading: boolean
  error: string | null
}

// Global cache to ensure we only fetch once across the entire app lifecycle
let manifestCache: {
  data: EpisodeManifest | null
  isLoading: boolean
  error: string | null
  promise: Promise<EpisodeManifest> | null
} = {
  data: null,
  isLoading: false,
  error: null,
  promise: null
}

/**
 * Custom hook to manage episode manifest data.
 * Fetches the manifest once and caches it for the entire application lifecycle.
 * Subsequent calls to this hook will return the cached data.
 */
export function useEpisodeManifest(): UseEpisodeManifestReturn {
  const [localState, setLocalState] = useState({
    episodeManifest: manifestCache.data,
    isLoading: manifestCache.isLoading,
    error: manifestCache.error
  })

  useEffect(() => {
    // If we already have data or are currently loading, don't fetch again
    if (manifestCache.data || manifestCache.isLoading) {
      setLocalState({
        episodeManifest: manifestCache.data,
        isLoading: manifestCache.isLoading,
        error: manifestCache.error
      })
      return
    }

    const fetchEpisodeManifest = async (): Promise<EpisodeManifest> => {
      const manifestPath = `${S3_HOSTED_FILES_BASE_URL}episode-manifest/full-episode-manifest.json`
      const response = await fetch(manifestPath)

      if (!response.ok) {
        throw new Error(`Failed to fetch episode manifest: ${response.status}`)
      }

      const manifestData: EpisodeManifest = await response.json()
      return manifestData
    }

    // Set loading state
    manifestCache.isLoading = true
    manifestCache.error = null
    
    setLocalState({
      episodeManifest: null,
      isLoading: true,
      error: null
    })

    // Create the fetch promise if it doesn't exist
    if (!manifestCache.promise) {
      manifestCache.promise = fetchEpisodeManifest()
    }

    // Handle the promise
    manifestCache.promise
      .then((manifestData) => {
        manifestCache.data = manifestData
        manifestCache.isLoading = false
        manifestCache.error = null
        
        setLocalState({
          episodeManifest: manifestData,
          isLoading: false,
          error: null
        })
      })
      .catch((e: any) => {
        const errorMessage = e.message || 'Failed to load episode manifest'
        log.error('[useEpisodeManifest] Failed to fetch episode manifest:', e)
        
        manifestCache.isLoading = false
        manifestCache.error = errorMessage
        manifestCache.promise = null // Reset promise so we can retry later
        
        setLocalState({
          episodeManifest: null,
          isLoading: false,
          error: errorMessage
        })
      })
  }, [])

  return localState
} 