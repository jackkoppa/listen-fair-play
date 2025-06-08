import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock SVG imports with ?react syntax
vi.mock('*.svg?react', () => ({
  default: vi.fn().mockImplementation(() => 'svg'),
}))

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
})

// Mock localStorage
const localStorageMock = {
  getItem: (_key: string) => null,
  setItem: (_key: string, _value: string) => {},
  removeItem: (_key: string) => {},
  clear: () => {},
  length: 0,
  key: (_index: number) => null,
}

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
})

// Mock scrollIntoView
Element.prototype.scrollIntoView = vi.fn()

// Global fetch mock setup
global.fetch = vi.fn() as any 