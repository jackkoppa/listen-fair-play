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

## Key Decisions Made:
- **Index file format**: `.msp` (binary format recommended by [Orama data persistence docs](https://docs.orama.com/open-source/plugins/plugin-data-persistence#persisting-the-database-to-disk-server-usage))
- **Sort field**: `episodePublishedUnixTimestamp` (unix timestamp for efficient sorting)
- **API compatibility**: No backward compatibility needed - redesigning for optimal Orama usage
- **Migration strategy**: Complete rebuild from SRT files, remove all FlexSearch/SQLite references
- **Schema optimization**: Removed `fileKey`, `podcastId`, `episodeTitle` from search index to keep it lightweight (client-side filtering via episode manifest)

## IMPORTANT: Build Process
⚠️ **After making changes to any packages, you must run `pnpm all:build` from the root directory.** This is required to update the `/dist` files for each package and ensure TypeScript compilation generates proper `.d.ts` files and JavaScript files.

## Task List for FlexSearch to Orama Migration

### Phase 1: Research & Setup ✅
- [x] **Task 1.1**: Choose replacement search library - **ORAMA SELECTED**
  - Orama chosen for TypeScript support, sorting capabilities, and data persistence
  - Key docs: [Getting Started](https://docs.orama.com/open-source), [Create Index](https://docs.orama.com/open-source/usage/create), [Data Persistence](https://docs.orama.com/open-source/plugins/plugin-data-persistence)

- [x] **Task 1.2**: Define new Orama schema and data structure - **COMPLETED**
  - ✅ Updated `packages/types/search.ts` with new Orama-compatible interfaces
  - ✅ Added `episodePublishedUnixTimestamp` field for sorting
  - ✅ Created comprehensive `SearchRequest`/`SearchResponse` interfaces
  - ✅ Defined `ORAMA_SEARCH_SCHEMA` constant for type safety
  - ✅ Enhanced search capabilities (sorting, filtering, better search options)
  - ✅ Optimized schema by removing `fileKey`, `podcastId`, `episodeTitle` for lightweight index

### Phase 2: Update Dependencies & Core Libraries
- [x] **Task 2.1**: Update package dependencies - **COMPLETED**
  - ✅ Removed `flexsearch` and `sqlite3` from all relevant packages
  - ✅ Added `@orama/orama` and `@orama/plugin-data-persistence` to catalog
  - ✅ Updated package.json files for types, database, search-lambda, and srt-indexing-lambda
  - ✅ Removed SQLite external references from rolldown.config.ts files
  - ✅ Removed SQLite Lambda layer from terraform configuration
  - ✅ Updated terraform comments to reference Orama instead of SQLite

- [x] **Task 2.2**: Update database utilities - **COMPLETED**
  - ✅ Replaced `createDocumentIndex` function with Orama `createOramaIndex()`
  - ✅ Implemented new index creation and persistence utilities using Orama
  - ✅ Removed all SQLite-related code from `packages/database/database.ts`
  - ✅ Added comprehensive Orama utilities: `insertSearchEntry`, `insertMultipleSearchEntries`, `searchOramaIndex`, `serializeOramaIndex`, `deserializeOramaIndex`
  - ✅ Updated exports in `packages/database/index.ts`
  - ✅ Updated constants to use `.msp` extension in `packages/constants/index.ts`
  - ✅ Fixed client components to work with new schema (removed `episodeTitle` references)
  - ✅ Files: `packages/database/database.ts`, `packages/database/index.ts`, `packages/constants/index.ts`

### Phase 3: Update Indexing Lambda (Lambda 3)
- [ ] **Task 3.1**: Replace FlexSearch index creation with Orama
  - Update `convert-srt-files-into-indexed-search-entries.ts`
  - Replace SQLite DB operations with Orama + data persistence plugin
  - Maintain existing SRT processing and JSON entry generation logic
  - Use Orama's `insertMultiple()` for batch insertion
  - Add logic to populate `episodePublishedUnixTimestamp` from episode manifest
  - Files: `packages/ingestion/srt-indexing-lambda/convert-srt-files-into-indexed-search-entries.ts`

- [ ] **Task 3.2**: Update index storage logic
  - Replace SQLite DB file with Orama serialized index using data persistence plugin
  - Update S3 key constants (change from `.db` to `.msp` extension)
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
  - Update API interface to use new `SearchRequest`/`SearchResponse` types
  - Use Orama's `search()` method with sorting options
  - Files: `packages/search/search-lambda/search-indexed-transcripts.ts`

- [ ] **Task 4.2**: Add date sorting capabilities
  - Implement sorting by episode published date using Orama's native sorting
  - Support combined relevance + date sorting with `sortBy` parameter
  - Maintain existing search features (highlighting with Orama's built-in support)
  - Test ascending/descending date sorts
  - Files: Search lambda, search types

- [ ] **Task 4.3**: Update search parameters
  - ✅ Already completed in Task 1.2 - `SearchRequest` interface updated
  - Update query parameter handling for GET/POST requests to support new parameters
  - Add support for `episodeIds` filtering from client-side episode selection
  - Files: Search lambda

### Phase 5: Update Client Integration
- [ ] **Task 5.1**: Update client-side search calls
  - Add sorting parameters to search requests from React client
  - Update search result handling for new Orama response format
  - Add UI controls for date sorting (newest first, oldest first)
  - Implement client-side episode filtering using episode manifest before sending to search API
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

## File References for Future Agents

### ✅ COMPLETED - Updated Files:
- **`packages/types/search.ts`** - Contains new Orama schema and interfaces
- **`pnpm-workspace.yaml`** - Updated with Orama dependencies in catalog
- **`packages/types/package.json`** - Removed flexsearch dependency
- **`packages/database/package.json`** - Updated with Orama dependencies
- **`packages/search/search-lambda/package.json`** - Updated with Orama dependencies
- **`packages/ingestion/srt-indexing-lambda/package.json`** - Updated with Orama dependencies
- **`packages/search/search-lambda/rolldown.config.ts`** - Removed sqlite3 external
- **`packages/ingestion/srt-indexing-lambda/rolldown.config.ts`** - Removed sqlite3 external
- **`terraform/main.tf`** - Removed SQLite Lambda layer and references

### 🔄 NEXT TO UPDATE - Current FlexSearch/SQLite Files:
- **`packages/database/src/index.ts`** - Current: exports `createDocumentIndex` function for FlexSearch
- **`packages/database/database.ts`** - Current: FlexSearch Document creation with SQLite
- **`packages/constants/src/index.ts`** - Current: `SEARCH_INDEX_DB_S3_KEY` uses `.db` extension
- **`packages/ingestion/srt-indexing-lambda/convert-srt-files-into-indexed-search-entries.ts`** - Current: FlexSearch indexing logic
- **`packages/search/search-lambda/search-indexed-transcripts.ts`** - Current: FlexSearch search logic

### 📋 REFERENCE FILES - No Changes Needed:
- **`aws-local-dev/s3/episode-manifest/full-episode-manifest.json`** - Episode manifest with `publishedAt` timestamps
- **`packages/types/episode-manifest.ts`** - Episode manifest type definitions
- **`terraform/lambda-layers/README.md`** - SQLite layer documentation (can be removed after migration)
- **`diagrams/aws-architecture.drawio`** - Architecture diagram (should be updated to reflect Orama)

### 🔍 KEY CONTEXT FILES:
- **Episode Manifest Structure**: Episodes contain `publishedAt` (ISO string) and `sequentialId` fields needed for search entries
- **SRT Processing**: `packages/ingestion/srt-indexing-lambda/utils/convert-srt-file-into-search-entry-array.ts` - Converts SRT to SearchEntry[]
- **Client Components**: `packages/client/src/components/SearchResult.tsx` and `packages/client/src/App.tsx` use search APIs

## Final Orama Schema (Implemented) ✅
```typescript
export const ORAMA_SEARCH_SCHEMA = {
  id: 'string',                         // Unique search entry ID
  text: 'string',                       // Transcript text (searchable)
  sequentialEpisodeId: 'number',        // Sequential episode ID from manifest
  startTimeMs: 'number',                // Start time in milliseconds
  endTimeMs: 'number',                  // End time in milliseconds
  episodePublishedUnixTimestamp: 'number', // Unix timestamp for sorting by date
} as const;
```

**Note**: Removed `podcastId`, `episodeTitle`, and `fileKey` from schema to keep index lightweight. These will be handled via client-side filtering using the episode manifest.

## Migration Benefits:
- ✅ **Native date sorting**: Sort by `episodePublishedUnixTimestamp` field easily
- ✅ **Remove SQLite dependency**: Eliminates Lambda layer complexity
- ✅ **Better TypeScript support**: Full type safety throughout
- ✅ **Improved performance**: Lighter weight, faster cold starts
- ✅ **Rich search features**: Built-in highlighting, faceted search
- ✅ **Data persistence**: Official plugin for S3 storage
- ✅ **Lightweight index**: Optimized schema reduces memory usage and improves performance

## Current Architecture (Before):
- FlexSearch + SQLite adapter
- Index stored as `search_index.db` in S3
- Complex SQLite operations for persistence
- Limited sorting capabilities

## New Architecture (After):
- Orama with data persistence plugin
- Index stored as serialized Orama index (`.msp`) in S3
- Simple save/load operations using data persistence plugin
- Native sorting by any field including dates
- Client-side episode filtering using episode manifest + server-side content search 