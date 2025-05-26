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

### 1. `SearchInput` Component ✅ COMPLETED
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

**Status**: ✅ **COMPLETED** - Component created and integrated, build tested successfully

### 2. `SearchControls` Component ✅ COMPLETED
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

**Status**: ✅ **COMPLETED** - Component created with full episode filtering functionality, build tested successfully

### 3. `SearchResults` Component ✅ COMPLETED
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

**Status**: ✅ **COMPLETED** - Component created with full error handling and results display, build tested successfully

### 4. `AppHeader` Component ⏳ NEXT PHASE
**Purpose**: Fixed header with scroll effects
**Location**: `src/components/AppHeader.tsx`
**Props**:
- `scrolled: boolean` - whether page is scrolled

**Responsibilities**:
- Render fixed header with title and subtitle
- Apply scroll-based styling transitions
- Handle responsive text sizing

**Status**: 🔄 **READY TO START**

**Implementation Details for Phase 4**:
- Extract the header JSX from App.tsx lines ~170-176:
```tsx
<header className={`fixed top-0 left-0 right-0 z-10 bg-secondary border-b-2 border-black shadow-[0px_4px_0px_rgba(0,0,0,1)] transition-all duration-300 ease-in-out ${scrolled ? 'py-2' : 'py-4'}`}>
  <div className="max-w-3xl mx-auto px-6 text-right">
    <h1 className={`font-bold text-black transition-all duration-200 ${scrolled ? 'text-2xl mb-0' : 'text-3xl mb-1'}`}>Listen, Fair Play</h1>
    <p className={`text-sm text-black italic transition-all duration-200 ${scrolled ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100'}`}>search the Football Clichés record books</p>
  </div>
</header>
```
- Create component with `scrolled` prop
- Update App.tsx to use `<AppHeader scrolled={scrolled} />`
- Test build and functionality

### 5. Enhanced `App.tsx` ⏳ FINAL PHASE
**Responsibilities** (simplified):
- Manage all application state
- Coordinate API calls (search and manifest fetching)
- Handle scroll detection
- Compose all child components
- Pass appropriate props to each component

**Status**: 🔄 **READY FOR CLEANUP**

## State Management Strategy
- **No additional libraries**: Keep all state in main App component
- **Prop drilling**: Pass state and handlers to child components as props
- **Future consideration**: If prop drilling becomes excessive, consider React Context for shared state like `episodeManifest`

## Migration Steps

### Phase 1: Extract SearchInput ✅ COMPLETED
1. ✅ Create `SearchInput.tsx` component
2. ✅ Move search input JSX and related styling
3. ✅ Update App.tsx to use new component
4. ✅ Test search functionality

### Phase 2: Extract SearchControls ✅ COMPLETED
1. ✅ Create `SearchControls.tsx` component
2. ✅ Move all search control logic and JSX
3. ✅ Move episode filtering logic to this component
4. ✅ Update App.tsx to use new component
5. ✅ Test filtering and sorting

### Phase 3: Extract SearchResults ✅ COMPLETED
1. ✅ Create `SearchResults.tsx` component  
2. ✅ Move results rendering logic
3. ✅ Move error and loading display logic
4. ✅ Update App.tsx to use new component
5. ✅ Test results display

### Phase 4: Extract AppHeader 🔄 NEXT UP
1. ⏳ Create `AppHeader.tsx` component
2. ⏳ Move header JSX and scroll-based styling
3. ⏳ Update App.tsx to use new component
4. ⏳ Test scroll effects

### Phase 5: Clean up App.tsx 🔄 FINAL PHASE
1. ⏳ Remove extracted JSX and move helper functions
2. ⏳ Organize imports and state declarations
3. ⏳ Add component documentation
4. ⏳ Final testing of all functionality

## Completed Work Summary

### ✅ Components Successfully Created:
- **SearchInput.tsx** (31 lines) - Clean, focused search input with loading spinner
- **SearchControls.tsx** (111 lines) - Complete filtering and sorting controls
- **SearchResults.tsx** (68 lines) - Full results display with error handling

### ✅ App.tsx Improvements:
- **Before**: 323 lines handling everything
- **Current**: ~185 lines (estimated after Phase 3)
- **Removed dependencies**: Button, Select components (moved to SearchControls)
- **Cleaner imports**: Focused on data types and core functionality

### ✅ All Builds Passing:
- TypeScript compilation: ✅
- Vite build: ✅ 
- No linting errors: ✅

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
├── App.tsx (~150 lines after completion)
├── components/
│   ├── SearchInput.tsx (31 lines) ✅
│   ├── SearchControls.tsx (111 lines) ✅
│   ├── SearchResults.tsx (68 lines) ✅
│   ├── AppHeader.tsx (~30 lines) ⏳
│   ├── SearchResult.tsx (existing)
│   ├── EpisodeDetailsSheet.tsx (existing)
│   └── ui/ (existing shadcn components)
```

## Next Agent Instructions

**To continue Phase 4 (AppHeader extraction):**

1. **Create AppHeader.tsx**:
   - Copy header JSX from App.tsx (around lines 170-176)
   - Create interface with `scrolled: boolean` prop
   - Maintain all existing CSS classes and styling
   - Export as default function

2. **Update App.tsx**:
   - Import new AppHeader component
   - Replace header JSX with `<AppHeader scrolled={scrolled} />`
   - Keep the header spacer div (`<div className="d-block h-10"></div>`)

3. **Test Phase 4**:
   - Run `pnpm build` to verify no errors
   - Test scroll effects still work properly

4. **Phase 5 cleanup**:
   - Organize imports alphabetically
   - Add JSDoc comments to main functions
   - Remove any unused variables
   - Final build test

**Build command**: `cd packages/client && pnpm build`

## Notes for Implementation
- Maintain all existing class names and styling
- Keep the same user experience and functionality
- Test each component extraction individually
- Consider TypeScript interfaces for props to ensure type safety
- Keep component files focused and avoid over-abstraction