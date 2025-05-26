# Client App Refactor Plan

## Overview
The current `App.tsx` (323 lines) is handling too many responsibilities. This plan breaks it into focused, reusable components while maintaining the existing functionality and avoiding additional state management libraries.

## Current App.tsx Analysis
The main component is handling:
- Search input with debounced search logic
- Search controls (sort options, episode filtering)
- Episode manifest fetching and management
- Search API calls and state management
- Results display and error handling
- Header with scroll effects
- Multiple pieces of state (search query, results, loading, error, manifests, etc.)

## Proposed Component Structure

### 1. `SearchInput` Component
**Purpose**: Isolated search input with loading indicator
**Location**: `src/components/SearchInput.tsx`
**Props**:
- `value: string` - current search query
- `onChange: (value: string) => void` - search query change handler
- `isLoading: boolean` - loading state for spinner
- `placeholder?: string` - input placeholder text

**Responsibilities**:
- Render search input with magnifying glass icon
- Show loading spinner when searching
- Handle input value changes

### 2. `SearchControls` Component  
**Purpose**: All search filtering and sorting controls
**Location**: `src/components/SearchControls.tsx`
**Props**:
- `searchQuery: string` - current query (to determine visibility)
- `sortOption: SortOption` - current sort selection
- `onSortChange: (option: SortOption) => void` - sort change handler
- `selectedEpisodeIds: number[]` - currently selected episodes
- `onEpisodeSelection: (episodeId: number, isSelected: boolean) => void` - episode selection handler
- `onClearEpisodeFilters: () => void` - clear all episode filters
- `availableEpisodes: Episode[]` - episodes available for filtering
- `showEpisodeFilter: boolean` - episode filter panel visibility
- `onToggleEpisodeFilter: () => void` - toggle episode filter visibility

**Responsibilities**:
- Render sort dropdown (relevance, newest, oldest)
- Render episode filter toggle button with count
- Render episode selection panel when open
- Handle all filter interactions

### 3. `SearchResults` Component
**Purpose**: Display search results, loading states, and errors
**Location**: `src/components/SearchResults.tsx`
**Props**:
- `results: ApiSearchResultHit[]` - search results to display
- `isLoading: boolean` - loading state
- `error: string | null` - error message if any
- `searchQuery: string` - current query for messaging
- `totalHits: number` - total number of results
- `processingTimeMs: number` - search processing time
- `episodeManifest: EpisodeManifest | null` - episode data for results

**Responsibilities**:
- Show loading message when searching
- Display error messages with styling
- Show "no results" message when appropriate
- Render results info (count, timing)
- Map over results and render SearchResult components

### 4. `AppHeader` Component
**Purpose**: Fixed header with scroll effects
**Location**: `src/components/AppHeader.tsx`
**Props**:
- `scrolled: boolean` - whether page is scrolled

**Responsibilities**:
- Render fixed header with title and subtitle
- Apply scroll-based styling transitions
- Handle responsive text sizing

### 5. Enhanced `App.tsx`
**Responsibilities** (simplified):
- Manage all application state
- Coordinate API calls (search and manifest fetching)
- Handle scroll detection
- Compose all child components
- Pass appropriate props to each component

## State Management Strategy
- **No additional libraries**: Keep all state in main App component
- **Prop drilling**: Pass state and handlers to child components as props
- **Future consideration**: If prop drilling becomes excessive, consider React Context for shared state like `episodeManifest`

## Migration Steps

### Phase 1: Extract SearchInput
1. Create `SearchInput.tsx` component
2. Move search input JSX and related styling
3. Update App.tsx to use new component
4. Test search functionality

### Phase 2: Extract SearchControls  
1. Create `SearchControls.tsx` component
2. Move all search control logic and JSX
3. Move episode filtering logic to this component
4. Update App.tsx to use new component
5. Test filtering and sorting

### Phase 3: Extract SearchResults
1. Create `SearchResults.tsx` component  
2. Move results rendering logic
3. Move error and loading display logic
4. Update App.tsx to use new component
5. Test results display

### Phase 4: Extract AppHeader
1. Create `AppHeader.tsx` component
2. Move header JSX and scroll-based styling
3. Update App.tsx to use new component
4. Test scroll effects

### Phase 5: Clean up App.tsx
1. Remove extracted JSX and move helper functions
2. Organize imports and state declarations
3. Add component documentation
4. Final testing of all functionality

## Benefits of This Approach
- **Single Responsibility**: Each component has one clear purpose
- **Reusability**: Components can be reused in other parts of the app
- **Testability**: Smaller components are easier to test in isolation  
- **Maintainability**: Easier to modify individual features
- **Future Growth**: Easy to add new filters to SearchControls
- **Performance**: Potential for better React optimization with smaller components

## File Structure After Refactor
```
src/
├── App.tsx (simplified - ~150 lines)
├── components/
│   ├── SearchInput.tsx (~50 lines)
│   ├── SearchControls.tsx (~100 lines)  
│   ├── SearchResults.tsx (~80 lines)
│   ├── AppHeader.tsx (~30 lines)
│   ├── SearchResult.tsx (existing)
│   ├── EpisodeDetailsSheet.tsx (existing)
│   └── ui/ (existing shadcn components)
```

## Notes for Implementation
- Maintain all existing class names and styling
- Keep the same user experience and functionality
- Test each component extraction individually
- Consider TypeScript interfaces for props to ensure type safety
- Keep component files focused and avoid over-abstraction