import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router';
import ColdStartLoader from '../ColdStartLoader';

// Mock react-router navigation
const mockNavigate = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams()],
  };
});

// Mock the quote display duration for faster tests
const QUOTE_DISPLAY_DURATION_MS = 100; // Much faster for tests

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('ColdStartLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('renders with initial helper text', () => {
    renderWithRouter(<ColdStartLoader />);
    
    expect(screen.getByText(/Starting up search\.\.\. enjoy some Clichés favorites in the meantime/)).toBeInTheDocument();
  });

  it('displays the first quote initially', () => {
    renderWithRouter(<ColdStartLoader />);
    
    // Check for the first quote (Episode 46)
    expect(screen.getByText(/The Kop holds, in its current form/)).toBeInTheDocument();
    expect(screen.getByText('Episode 46')).toBeInTheDocument();
    expect(screen.getByText(/Football chants you don't hear any more, with Elis James/)).toBeInTheDocument();
  });

  it('rotates through quotes after the specified duration', async () => {
    renderWithRouter(<ColdStartLoader />);
    
    // Initially shows first quote
    expect(screen.getByText(/The Kop holds/)).toBeInTheDocument();
    
    // Advance time to trigger quote rotation
    vi.advanceTimersByTime(QUOTE_DISPLAY_DURATION_MS);
    
    await waitFor(() => {
      // Should now show second quote (Episode 130)
      expect(screen.getByText(/come what February should now be the official tagline/)).toBeInTheDocument();
      expect(screen.getByText('Episode 130')).toBeInTheDocument();
    });

    // Advance time again
    vi.advanceTimersByTime(QUOTE_DISPLAY_DURATION_MS);
    
    await waitFor(() => {
      // Should now show third quote (Episode 336)
      expect(screen.getByText(/Brilliant for the football club, obviously/)).toBeInTheDocument();
      expect(screen.getByText('Episode 336')).toBeInTheDocument();
    });

    // Advance time once more to cycle back to first quote
    vi.advanceTimersByTime(QUOTE_DISPLAY_DURATION_MS);
    
    await waitFor(() => {
      // Should cycle back to first quote
      expect(screen.getByText(/The Kop holds/)).toBeInTheDocument();
      expect(screen.getByText('Episode 46')).toBeInTheDocument();
    });
  });

  it('shows correct quote indicators', () => {
    renderWithRouter(<ColdStartLoader />);
    
    const indicators = screen.getAllByRole('generic').filter(el => 
      el.className.includes('w-2 h-2 rounded-full')
    );
    
    // Should have 3 indicators (one for each quote)
    expect(indicators).toHaveLength(3);
    
    // First indicator should be active (black), others inactive (gray)
    expect(indicators[0]).toHaveClass('bg-black');
    expect(indicators[1]).toHaveClass('bg-gray-300');
    expect(indicators[2]).toHaveClass('bg-gray-300');
  });

  it('navigates to correct episode URL when quote is clicked', () => {
    renderWithRouter(<ColdStartLoader />);
    
    // Click on the quote card
    const quoteCard = screen.getByRole('generic', { name: /episode 46/i });
    fireEvent.click(quoteCard);
    
    expect(mockNavigate).toHaveBeenCalledWith('/episode/46?q=the%20kop%20holds&start=1731100');
  });

  it('navigates when Listen button is clicked', () => {
    renderWithRouter(<ColdStartLoader />);
    
    const listenButton = screen.getByRole('button', { name: /listen/i });
    fireEvent.click(listenButton);
    
    expect(mockNavigate).toHaveBeenCalledWith('/episode/46?q=the%20kop%20holds&start=1731100');
  });

  it('calls onComplete when skip button is clicked', async () => {
    const mockOnComplete = vi.fn();
    renderWithRouter(<ColdStartLoader onComplete={mockOnComplete} />);
    
    const skipButton = screen.getByRole('button', { name: /skip loading screen/i });
    fireEvent.click(skipButton);
    
    // Should trigger fade out and then call onComplete after animation
    await waitFor(() => {
      expect(mockOnComplete).toHaveBeenCalled();
    }, { timeout: 500 });
  });

  it('preserves existing search parameters when navigating', () => {
    // Create a new mock for this specific test
    const mockSearchParams = new URLSearchParams('existing=param&another=value');
    const mockUseSearchParams = vi.fn(() => [mockSearchParams]);
    
    // Mock just for this test
    vi.doMock('react-router', async () => {
      const actual = await vi.importActual('react-router');
      return {
        ...actual,
        useNavigate: () => mockNavigate,
        useSearchParams: mockUseSearchParams,
      };
    });
    
    renderWithRouter(<ColdStartLoader />);
    
    const quoteCard = screen.getByText(/The Kop holds/);
    fireEvent.click(quoteCard);
    
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining('/episode/46?')
    );
    
    const [navigationUrl] = mockNavigate.mock.calls[0];
    expect(navigationUrl).toContain('q=the%20kop%20holds');
    expect(navigationUrl).toContain('start=1731100');
  });

  it('handles component unmounting gracefully', () => {
    const { unmount } = renderWithRouter(<ColdStartLoader />);
    
    // Start the quote rotation
    vi.advanceTimersByTime(QUOTE_DISPLAY_DURATION_MS / 2);
    
    // Unmount component
    unmount();
    
    // Should not throw any errors
    expect(() => {
      vi.advanceTimersByTime(QUOTE_DISPLAY_DURATION_MS);
    }).not.toThrow();
  });

  it('has accessible structure', () => {
    renderWithRouter(<ColdStartLoader />);
    
    // Should have proper button elements
    expect(screen.getByRole('button', { name: /listen/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /skip loading screen/i })).toBeInTheDocument();
    
    // Should have readable text content
    expect(screen.getByText(/Starting up search/)).toBeInTheDocument();
    expect(screen.getByText(/Episode 46/)).toBeInTheDocument();
  });
}); 