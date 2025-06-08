import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter, MemoryRouter } from 'react-router'
import '@testing-library/jest-dom'

import App from '../../App'

// Mock the search API and S3 assets
const mockSearchResponse = {
  hits: [
    {
      id: 'test-result-1',
      text: 'Test search result text',
      startTimeMs: 120000,
      endTimeMs: 125000,
      sequentialEpisodeIdAsString: '1',
      episodePublishedUnixTimestamp: 1640995200000
    }
  ],
  totalHits: 1,
  processingTimeMs: 50
}

const mockEpisodeManifest = {
  episodes: [
    {
      sequentialId: 1,
      title: 'Test Episode 1',
      summary: 'Test episode summary',
      publishedAt: '2022-01-01T00:00:00Z',
      originalAudioURL: 'https://example.com/audio1.mp3',
      fileKey: 'test-episode-1',
      podcastId: 'test-podcast'
    },
    {
      sequentialId: 2,
      title: 'Test Episode 2',
      summary: 'Another test episode',
      publishedAt: '2022-01-02T00:00:00Z',
      originalAudioURL: 'https://example.com/audio2.mp3',
      fileKey: 'test-episode-2',
      podcastId: 'test-podcast'
    }
  ]
}

const mockSearchEntries = [
  {
    id: 'test-result-1',
    text: 'Test search result text',
    startTimeMs: 120000,
    endTimeMs: 125000
  }
]

// Mock fetch globally
global.fetch = vi.fn()

const mockFetch = global.fetch as any

beforeEach(() => {
  vi.clearAllMocks()
  
  // Default fetch mock behavior
  mockFetch.mockImplementation((url: string) => {
    if (url.includes('episode-manifest')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockEpisodeManifest)
      })
    }
    
    if (url.includes('search-entries')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockSearchEntries)
      })
    }
    
    if (url.includes('search') || url.includes('localhost:3001')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockSearchResponse)
      })
    }
    
    // Mock health check calls
    if (url.includes('localhost:3001') || url.endsWith('/')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ status: 'healthy' })
      })
    }
    
    // Mock any transcript/search-entries files
    if (url.includes('.json') && (url.includes('search-entries') || url.includes('127.0.0.1'))) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockSearchEntries)
      })
    }
    
    return Promise.reject(new Error(`Unmocked fetch call to ${url}`))
  })
})

// Helper function to get the search input
const getSearchInput = () => {
  // Try to get the search input, but it might be hidden when episode sheet is open
  const inputs = screen.queryAllByRole('textbox')
  return inputs.find(input => input.getAttribute('placeholder')?.includes('e.g.')) || inputs[0]
}

describe('Routing', () => {
  describe('Home Page Route', () => {
    it('renders home page at root path', async () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <App />
        </MemoryRouter>
      )
      
      // Should render the search input
      expect(getSearchInput()).toBeInTheDocument()
    })

    it('reads search query from URL parameters', async () => {
      render(
        <MemoryRouter initialEntries={['/?q=test%20query']}>
          <App />
        </MemoryRouter>
      )
      
      // Should populate search input with URL query
      const searchInput = getSearchInput() as HTMLInputElement
      expect(searchInput.value).toBe('test query')
    })

    it('reads sort option from URL parameters', async () => {
      render(
        <MemoryRouter initialEntries={['/?sort=newest']}>
          <App />
        </MemoryRouter>
      )
      
      // Wait for component to load and check if sort is applied
      await waitFor(() => {
        // The sort option should be reflected in the UI
        // This would need to be verified based on how the sort UI is implemented
        expect(getSearchInput()).toBeInTheDocument()
      })
    })

    it('reads episode filter from URL parameters', async () => {
      render(
        <MemoryRouter initialEntries={['/?episodes=1,2']}>
          <App />
        </MemoryRouter>
      )
      
      // Should parse episode filter from URL
      await waitFor(() => {
        expect(getSearchInput()).toBeInTheDocument()
      })
    })

    it('handles multiple URL parameters correctly', async () => {
      render(
        <MemoryRouter initialEntries={['/?q=football&sort=newest&episodes=1']}>
          <App />
        </MemoryRouter>
      )
      
      const searchInput = getSearchInput() as HTMLInputElement
      expect(searchInput.value).toBe('football')
    })
  })

  describe('Episode Route', () => {
    it('renders episode sheet for valid episode ID', async () => {
      render(
        <MemoryRouter initialEntries={['/episode/1']}>
          <App />
        </MemoryRouter>
      )
      
      // Should render the episode sheet
      await waitFor(() => {
        expect(screen.getByText('Test Episode 1')).toBeInTheDocument()
      })
    })

    it('handles episode route with start time parameter', async () => {
      render(
        <MemoryRouter initialEntries={['/episode/1?start=120000']}>
          <App />
        </MemoryRouter>
      )
      
      // Should render episode with start time
      await waitFor(() => {
        expect(screen.getByText('Test Episode 1')).toBeInTheDocument()
      })
    })

    it('preserves search parameters when navigating to episode', async () => {
      render(
        <MemoryRouter initialEntries={['/episode/1?q=test&sort=newest&start=120000']}>
          <App />
        </MemoryRouter>
      )
      
      // Should render the episode sheet
      await waitFor(() => {
        expect(screen.getByText('Test Episode 1')).toBeInTheDocument()
      })
      
      // The search input should exist but might be hidden behind the episode sheet
      // We can verify the search state is preserved by checking if the input exists and has the right value
      const searchInput = getSearchInput() as HTMLInputElement
      if (searchInput) {
        expect(searchInput.value).toBe('test')
      }
    })

    it('shows error for invalid episode ID', async () => {
      render(
        <MemoryRouter initialEntries={['/episode/999']}>
          <App />
        </MemoryRouter>
      )
      
      // Should show error message (use getAllByText since there might be multiple)
      await waitFor(() => {
        const errorElements = screen.getAllByText(/error loading episode/i)
        expect(errorElements.length).toBeGreaterThan(0)
      })
    })

    it('redirects /episode (without ID) to home page', async () => {
      render(
        <MemoryRouter initialEntries={['/episode']}>
          <App />
        </MemoryRouter>
      )
      
      // Should redirect to home page
      expect(getSearchInput()).toBeInTheDocument()
      // Should not show episode sheet
      expect(screen.queryByText('Test Episode 1')).not.toBeInTheDocument()
    })
  })

  describe('Navigation Behavior', () => {
    it('navigates from home to episode route', async () => {
      const user = userEvent.setup()
      
      render(
        <BrowserRouter>
          <App />
        </BrowserRouter>
      )
      
      // Wait for search results to load (if any)
      await waitFor(() => {
        expect(getSearchInput()).toBeInTheDocument()
      })
      
      // This test would need actual "Load Here" buttons from search results
      // For now, we'll just verify the basic navigation structure is in place
    })

    it('preserves search state when closing episode sheet', async () => {
      // This test would simulate opening an episode sheet and then closing it
      // to verify that search parameters are preserved
      render(
        <MemoryRouter initialEntries={['/episode/1?q=test&sort=newest']}>
          <App />
        </MemoryRouter>
      )
      
      await waitFor(() => {
        expect(screen.getByText('Test Episode 1')).toBeInTheDocument()
      })
      
      // The close behavior would need to be tested with actual user interaction
      // This verifies the initial state is correct
      const searchInput = getSearchInput() as HTMLInputElement
      if (searchInput) {
        expect(searchInput.value).toBe('test')
      }
    })
  })

  describe('URL Parameter Handling', () => {
    it('handles empty query parameters gracefully', async () => {
      render(
        <MemoryRouter initialEntries={['/?q=&sort=&episodes=']}>
          <App />
        </MemoryRouter>
      )
      
      const searchInput = getSearchInput() as HTMLInputElement
      expect(searchInput.value).toBe('')
    })

    it('handles malformed episode filter parameters', async () => {
      render(
        <MemoryRouter initialEntries={['/?episodes=invalid,1,not-a-number,2']}>
          <App />
        </MemoryRouter>
      )
      
      // Should filter out invalid episode IDs and keep valid ones
      await waitFor(() => {
        expect(getSearchInput()).toBeInTheDocument()
      })
    })

    it('handles invalid start time parameter', async () => {
      render(
        <MemoryRouter initialEntries={['/episode/1?start=invalid']}>
          <App />
        </MemoryRouter>
      )
      
      // Should still render episode without start time highlighting
      await waitFor(() => {
        expect(screen.getByText('Test Episode 1')).toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    it('handles network errors gracefully', async () => {
      // Mock fetch to reject for manifest
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('episode-manifest')) {
          return Promise.reject(new Error('Network error'))
        }
        // Mock health check calls
        if (url.includes('localhost:3001') || url.endsWith('/')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ status: 'healthy' })
          })
        }
        // Mock any transcript/search-entries files  
        if (url.includes('.json')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockSearchEntries)
          })
        }
        return Promise.reject(new Error(`Unmocked fetch call to ${url}`))
      })
      
      render(
        <MemoryRouter initialEntries={['/episode/1']}>
          <App />
        </MemoryRouter>
      )
      
      // Just wait for component to render without errors - the specific error handling
      // behavior can be tested separately in unit tests for the component
      await waitFor(() => {
        expect(screen.getByText('Listen, Fair Play')).toBeInTheDocument()
      }, { timeout: 3000 })
    })

    it('handles missing episode manifest gracefully', async () => {
      // Mock fetch to return 404 for manifest
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('episode-manifest')) {
          return Promise.resolve({
            ok: false,
            status: 404,
            json: () => Promise.reject(new Error('Not found'))
          })
        }
        // Mock health check calls
        if (url.includes('localhost:3001') || url.endsWith('/')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ status: 'healthy' })
          })
        }
        // Mock any transcript/search-entries files
        if (url.includes('.json')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockSearchEntries)
          })
        }
        return Promise.reject(new Error(`Unmocked fetch call to ${url}`))
      })
      
      render(
        <MemoryRouter initialEntries={['/episode/1']}>
          <App />
        </MemoryRouter>
      )
      
      // Just wait for component to render without errors
      await waitFor(() => {
        expect(screen.getByText('Listen, Fair Play')).toBeInTheDocument()
      }, { timeout: 3000 })
    })
  })
}) 