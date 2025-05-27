import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SearchInput from '../SearchInput';

describe('SearchInput', () => {
  const defaultProps = {
    value: '',
    onChange: vi.fn(),
    isLoading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with placeholder text', () => {
    render(<SearchInput {...defaultProps} />);
    
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('placeholder');
    expect(input.getAttribute('placeholder')).toMatch(/^e\.g\. "/);
  });

  it('displays search icon', () => {
    render(<SearchInput {...defaultProps} />);
    
    // The MagnifyingGlassIcon should be present
    const container = screen.getByRole('textbox').parentElement;
    expect(container).toBeInTheDocument();
  });

  it('calls onChange when input value changes', () => {
    const mockOnChange = vi.fn();
    render(<SearchInput {...defaultProps} onChange={mockOnChange} />);
    
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'test query' } });
    
    expect(mockOnChange).toHaveBeenCalledWith('test query');
  });

  it('shows loading spinner when isLoading is true', () => {
    render(<SearchInput {...defaultProps} isLoading={true} />);
    
    // Look for the spinner element
    const spinner = document.querySelector('.search-spinner');
    expect(spinner).toBeInTheDocument();
  });

  it('does not show loading spinner when isLoading is false', () => {
    render(<SearchInput {...defaultProps} isLoading={false} />);
    
    const spinner = document.querySelector('.search-spinner');
    expect(spinner).not.toBeInTheDocument();
  });

  describe('Helper Text Functionality', () => {
    it('does not show helper text initially', () => {
      render(<SearchInput {...defaultProps} />);
      
      expect(screen.queryByText(/Please enter at least 2 characters/)).not.toBeInTheDocument();
    });

    it('does not show helper text when input is focused but not yet blurred', () => {
      render(<SearchInput {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      
      expect(screen.queryByText(/Please enter at least 2 characters/)).not.toBeInTheDocument();
    });

    it('shows helper text after focus and blur with empty value', () => {
      render(<SearchInput {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      fireEvent.blur(input);
      
      expect(screen.getByText(/Please enter at least 2 characters to search/)).toBeInTheDocument();
    });

    it('shows helper text after focus and blur with single character', () => {
      const mockOnChange = vi.fn();
      render(<SearchInput {...defaultProps} value="a" onChange={mockOnChange} />);
      
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      fireEvent.blur(input);
      
      expect(screen.getByText(/Please enter at least 2 characters to search/)).toBeInTheDocument();
    });

    it('does not show helper text after focus and blur with 2+ characters', () => {
      const mockOnChange = vi.fn();
      render(<SearchInput {...defaultProps} value="ab" onChange={mockOnChange} />);
      
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      fireEvent.blur(input);
      
      expect(screen.queryByText(/Please enter at least 2 characters/)).not.toBeInTheDocument();
    });

    it('hides helper text when user focuses after it was shown', () => {
      render(<SearchInput {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      
      // Show helper text
      fireEvent.focus(input);
      fireEvent.blur(input);
      expect(screen.getByText(/Please enter at least 2 characters/)).toBeInTheDocument();
      
      // Focus again should hide it
      fireEvent.focus(input);
      expect(screen.queryByText(/Please enter at least 2 characters/)).not.toBeInTheDocument();
    });

    it('hides helper text when user types 2+ characters', () => {
      const mockOnChange = vi.fn();
      render(<SearchInput {...defaultProps} onChange={mockOnChange} />);
      
      const input = screen.getByRole('textbox');
      
      // Show helper text first
      fireEvent.focus(input);
      fireEvent.blur(input);
      expect(screen.getByText(/Please enter at least 2 characters/)).toBeInTheDocument();
      
      // Simulate typing 2 characters (this will trigger handleChange internally)
      fireEvent.change(input, { target: { value: 'ab' } });
      
      expect(screen.queryByText(/Please enter at least 2 characters/)).not.toBeInTheDocument();
    });

    it('shows helper text only after first focus/blur cycle', () => {
      render(<SearchInput {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      
      // Just blur without focus should not show helper text
      fireEvent.blur(input);
      expect(screen.queryByText(/Please enter at least 2 characters/)).not.toBeInTheDocument();
      
      // Now focus and blur should show it
      fireEvent.focus(input);
      fireEvent.blur(input);
      expect(screen.getByText(/Please enter at least 2 characters/)).toBeInTheDocument();
    });

    it('handles whitespace-only input correctly', () => {
      const mockOnChange = vi.fn();
      render(<SearchInput {...defaultProps} value="   " onChange={mockOnChange} />);
      
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      fireEvent.blur(input);
      
      // Should show helper text because trimmed length is 0
      expect(screen.getByText(/Please enter at least 2 characters/)).toBeInTheDocument();
    });

    it('helper text has correct styling classes', () => {
      render(<SearchInput {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      fireEvent.blur(input);
      
      const helperText = screen.getByText(/Please enter at least 2 characters/);
      expect(helperText).toHaveClass('text-sm', 'text-gray-500', 'mt-2', 'text-center', 'font-mono');
    });
  });

  describe('Integration Tests', () => {
    it('maintains proper state through multiple focus/blur/type cycles', () => {
      const mockOnChange = vi.fn();
      render(<SearchInput {...defaultProps} onChange={mockOnChange} />);
      
      const input = screen.getByRole('textbox');
      
      // Cycle 1: focus/blur with empty - should show helper
      fireEvent.focus(input);
      fireEvent.blur(input);
      expect(screen.getByText(/Please enter at least 2 characters/)).toBeInTheDocument();
      
      // Type enough characters - should hide helper
      fireEvent.change(input, { target: { value: 'test' } });
      expect(screen.queryByText(/Please enter at least 2 characters/)).not.toBeInTheDocument();
      
      // Clear and blur again - should show helper again
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.blur(input);
      expect(screen.getByText(/Please enter at least 2 characters/)).toBeInTheDocument();
      
      // Focus again - should hide
      fireEvent.focus(input);
      expect(screen.queryByText(/Please enter at least 2 characters/)).not.toBeInTheDocument();
    });
  });
}); 