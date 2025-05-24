# FlexSearch to Orama Migration

## Overview
Replacing FlexSearch with [Orama](https://github.com/oramasearch/orama) to support sorting by episode published date and enhanced search capabilities. Orama is a complete search engine with TypeScript support, under 2kb, with excellent sorting and data persistence capabilities.

## Why Orama?
- **Excellent sorting support**: Native support for sorting by any field, including dates
- **TypeScript native**: Full TypeScript support out of the box
- **Data persistence plugin**: Official plugin for saving/loading indexes to/from storage (S3)
- **Lightweight**: Less than 2kb, optimized for performance
- **Rich search features**: Full-text search, highlighting, faceted search
- **No external dependencies**: Eliminates SQLite dependency

## Task List for FlexSearch to Orama Migration

### Phase 1: Research & Setup ✅
- [x] **Task 1.1**: Choose replacement search library - **ORAMA SELECTED**
  - Orama chosen for TypeScript support, sorting capabilities, and data persistence
  - Key docs: [Getting Started](https://docs.orama.com/open-source), [Create Index](https://docs.orama.com/open-source/usage/create), [Data Persistence](https://docs.orama.com/open-source/plugins/plugin-data-persistence)

- [ ] **Task 1.2**: Define new Orama schema and data structure
  - Design Orama schema that supports date sorting and current search fields
  - Define serialization format using data persistence plugin
  - Files: Update `packages/types/src/search-types.ts`

### Phase 2: Update Dependencies & Core Libraries
- [ ] **Task 2.1**: Update package dependencies
  - Remove `flexsearch` and `sqlite3` from relevant packages
  - Add `@orama/orama` and `@orama/plugin-data-persistence`
  - Remove SQLite Lambda layer from deployment
  - Files: `packages/*/package.json`, deployment configurations

- [ ] **Task 2.2**: Update database utilities
  - Replace `createDocumentIndex` function with Orama `create()`
  - Implement new index creation and persistence utilities using Orama
  - Remove all SQLite-related code
  - Files: `packages/database/src/index.ts`, `packages/database/src/search-index.ts`

### Phase 3: Update Indexing Lambda (Lambda 3)
- [ ] **Task 3.1**: Replace FlexSearch index creation with Orama
  - Update `convert-srt-files-into-indexed-search-entries.ts`
  - Replace SQLite DB operations with Orama + data persistence plugin
  - Maintain existing SRT processing and JSON entry generation logic
  - Use Orama's `insertMultiple()` for batch insertion
  - Files: `packages/ingestion/srt-indexing-lambda/convert-srt-files-into-indexed-search-entries.ts`

- [ ] **Task 3.2**: Update index storage logic
  - Replace SQLite DB file with Orama serialized index using data persistence plugin
  - Update S3 key constants (change from `.db` to appropriate extension)
  - Ensure schema includes episode metadata with proper types for date sorting
  - Files: `packages/constants/src/index.ts`, indexing lambda

- [ ] **Task 3.3**: Test index generation
  - Verify new Orama index format is created and serialized correctly
  - Test with existing SRT files and episode manifest
  - Validate index file size and performance vs SQLite
  - Files: Test scripts, sample data

### Phase 4: Update Search Lambda (Lambda 4)
- [ ] **Task 4.1**: Replace FlexSearch query logic with Orama
  - Update `search-indexed-transcripts.ts`
  - Implement Orama initialization and querying using data persistence plugin
  - Maintain existing API interface (`SearchRequest`/`SearchResponse`)
  - Use Orama's `search()` method with sorting options
  - Files: `packages/search/search-lambda/search-indexed-transcripts.ts`

- [ ] **Task 4.2**: Add date sorting capabilities
  - Implement sorting by episode published date using Orama's native sorting
  - Support combined relevance + date sorting with `sortBy` parameter
  - Maintain existing search features (highlighting with Orama's built-in support)
  - Test ascending/descending date sorts
  - Files: Search lambda, search types

- [ ] **Task 4.3**: Update search parameters
  - Add sort options to `SearchRequest` interface (`sortBy`, `sortOrder`)
  - Update query parameter handling for GET/POST requests
  - Ensure backward compatibility where possible
  - Add support for Orama's additional search options
  - Files: `packages/types/src/search-types.ts`, search lambda

### Phase 5: Update Client Integration
- [ ] **Task 5.1**: Update client-side search calls
  - Add sorting parameters to search requests from React client
  - Update search result handling for new Orama response format
  - Add UI controls for date sorting (newest first, oldest first)
  - Files: `packages/client/src/` (search components)

### Phase 6: Testing & Validation
- [ ] **Task 6.1**: End-to-end testing
  - Test full pipeline: SRT → Orama Index → Search with sorting
  - Verify search results are properly sorted by date
  - Performance testing with existing data volume
  - Compare performance vs FlexSearch+SQLite
  - Files: Test scripts, integration tests

- [ ] **Task 6.2**: Deployment validation
  - Deploy to staging environment
  - Test with production data volume
  - Validate Lambda performance and memory usage
  - Monitor cold start times (should improve without SQLite)
  - Files: Deployment scripts, monitoring

## Key Files for Reference:
- `packages/ingestion/srt-indexing-lambda/convert-srt-files-into-indexed-search-entries.ts`
- `packages/search/search-lambda/search-indexed-transcripts.ts`
- `packages/types/src/search-types.ts`
- `packages/database/src/index.ts`
- `packages/constants/src/index.ts`
- `diagrams/aws-architecture.drawio`

## Orama Schema Design (Proposed)
```typescript
const schema = {
  id: 'string',           // Unique search entry ID
  text: 'string',         // Transcript text (searchable)
  episodeId: 'number',    // Sequential episode ID
  podcastName: 'string',  // Podcast name (filterable)
  episodeTitle: 'string', // Episode title (searchable)
  publishedDate: 'string', // ISO date string (sortable)
  startTime: 'number',    // Start time in seconds
  endTime: 'number',      // End time in seconds
  fileKey: 'string',      // Original file key
}
```

## Migration Benefits:
- ✅ **Native date sorting**: Sort by `publishedDate` field easily
- ✅ **Remove SQLite dependency**: Eliminates Lambda layer complexity
- ✅ **Better TypeScript support**: Full type safety throughout
- ✅ **Improved performance**: Lighter weight, faster cold starts
- ✅ **Rich search features**: Built-in highlighting, faceted search
- ✅ **Data persistence**: Official plugin for S3 storage

## Current Architecture (Before):
- FlexSearch + SQLite adapter
- Index stored as `search_index.db` in S3
- Complex SQLite operations for persistence
- Limited sorting capabilities

## New Architecture (After):
- Orama with data persistence plugin
- Index stored as serialized Orama index in S3
- Simple save/load operations
- Native sorting by any field including dates 