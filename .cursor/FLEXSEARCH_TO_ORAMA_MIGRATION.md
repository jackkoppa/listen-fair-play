# FlexSearch to Orama Migration

## Overview
Replacing FlexSearch with [Orama](https://github.com/oramasearch/orama) to support sorting by episode published date and enhanced search capabilities. Orama is a complete search engine with TypeScript support, under 2kb, with excellent sorting and data persistence capabilities.

## ⚠️ IMPORTANT INSTRUCTIONS FOR AGENTS

**When working through this migration guide, you MUST follow these instructions:**

1. **Complete ONE task at a time** - Do not skip ahead or work on multiple tasks simultaneously
2. **Stop after completing each listed task** - Always pause and ask the user for approval before proceeding
3. **Wait for user confirmation** - The user wants to review all changes before moving to the next step
4. **Clearly indicate what you completed** - Update the task status and provide a summary of what was accomplished
5. **Ask before proceeding** - Always prompt: "Task X.Y has been completed. Would you like me to proceed to the next task, or would you like to review/modify anything first?"

This ensures the user maintains control over the migration process and can validate each step before continuing.

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
- [x] **Task 3.1**: Replace FlexSearch index creation with Orama - **COMPLETED**
  - ✅ Updated `convert-srt-files-into-indexed-search-entries.ts` to use Orama instead of FlexSearch + SQLite
  - ✅ Replaced SQLite DB operations with Orama serialization/deserialization using data persistence plugin  
  - ✅ Maintained existing SRT processing and JSON entry generation logic
  - ✅ Implemented Orama's `insertMultipleSearchEntries()` for efficient batch insertion
  - ✅ Added logic to populate `episodePublishedUnixTimestamp` from episode manifest `publishedAt` field
  - ✅ Updated `convert-srt-file-into-search-entry-array.ts` utility to accept and use `episodePublishedUnixTimestamp`
  - ✅ Switched from SQLite `.db` format to Orama binary `.msp` format for S3 storage
  - ✅ Removed all SQLite dependencies and FlexSearch `index.commit()` operations
  - ✅ Files: `packages/ingestion/srt-indexing-lambda/convert-srt-files-into-indexed-search-entries.ts`, `packages/ingestion/srt-indexing-lambda/utils/convert-srt-file-into-search-entry-array.ts`

- [x] **Task 3.2**: Update index storage logic - **COMPLETED**
  - ✅ Updated S3 key constants (changed from `.db` to `.msp` extension) in `packages/constants/index.ts`
  - ✅ Schema includes episode metadata with proper types for date sorting (`episodePublishedUnixTimestamp`)
  - ✅ Files: `packages/constants/index.ts`, indexing lambda

- [x] **Task 3.3**: Test index generation - **COMPLETED**
  - ✅ Fixed episode ID filtering logic to use Orama where clause filtering with `sequentialEpisodeIdAsString` field (converted from number to string for Orama string array filtering compatibility)
  - ✅ Verified new Orama index format is created and serialized correctly
  - ✅ Tested with test data including search, sorting, filtering, serialization, and deserialization
  - ✅ Validated index file size and performance vs SQLite - excellent performance (8,547+ entries/sec insertion, 1ms search on 1000 entries)
  - ✅ All tests passing: index creation, entry insertion, search functionality, date sorting, episode filtering (using Orama where clause), serialization, deserialization, and performance
  - ✅ **IMPORTANT FIX**: Changed `sequentialEpisodeId` (number) to `sequentialEpisodeIdAsString` (string) to enable proper Orama array filtering during search instead of post-search filtering
  - ✅ Files: `packages/types/search.ts`, `packages/database/database.ts`, `packages/ingestion/srt-indexing-lambda/test-orama-index-generation.ts`, `packages/client/src/App.tsx`, `packages/client/src/components/SearchResult.tsx`, `packages/ingestion/srt-indexing-lambda/utils/convert-srt-file-into-search-entry-array.ts`, fixture files

### Phase 4: Update Search Lambda (Lambda 4)
- [x] **Task 4.1**: Replace FlexSearch query logic with Orama - **COMPLETED**
  - ✅ Updated `search-indexed-transcripts.ts` to use Orama instead of FlexSearch + SQLite
  - ✅ Replaced SQLite initialization with Orama index deserialization using data persistence plugin
  - ✅ Implemented new search logic using `searchOramaIndex()` function from database utilities
  - ✅ Updated API interface to use new `SearchRequest`/`SearchResponse` types from types package
  - ✅ Added support for new search parameters: `sortBy`, `sortOrder`, `episodeIds` filtering
  - ✅ Maintained backward compatibility for existing query parameter formats (GET/POST/direct invocation)
  - ✅ Replaced FlexSearch-specific parameters (`suggest`, `matchAllFields`) with Orama native capabilities
  - ✅ Updated test script to use new Orama search parameters
  - ✅ Fixed ESM import issues and ensured proper TypeScript compilation
  - ✅ Files: `packages/search/search-lambda/search-indexed-transcripts.ts`, `packages/search/search-lambda/simple-test-local.ts`

- [x] **Task 4.2**: Add date sorting capabilities - **COMPLETED**
  - ✅ Implemented sorting by episode published date using Orama's native sorting in `searchOramaIndex()` function
  - ✅ Support for combined relevance + date sorting with `sortBy` parameter (any field including `episodePublishedUnixTimestamp`)
  - ✅ Maintained existing search features with Orama's built-in highlighting support
  - ✅ Support for both ascending/descending date sorts via `sortOrder` parameter
  - ✅ Native Orama sorting is more efficient than post-search sorting used in FlexSearch
  - ✅ Files: `packages/database/database.ts` (searchOramaIndex function), search lambda already updated

- [x] **Task 4.3**: Update search parameters - **COMPLETED**
  - ✅ Already completed in Task 1.2 - `SearchRequest` interface updated with new Orama parameters
  - ✅ Already completed in Task 4.1 - Updated query parameter handling for GET/POST requests to support new parameters  
  - ✅ Already completed in Task 4.1 - Added support for `episodeIds` filtering from client-side episode selection
  - ✅ All parameter mappings implemented and working with API Gateway integration (GET/POST/direct invocation)
  - ✅ Files: Search lambda (already updated), types package (already updated)

### Phase 5: Update Client Integration
- [x] **Task 5.1**: Update client-side search calls - **COMPLETED**
  - ✅ Added sorting parameters to search requests using new Orama `SearchRequest` interface
  - ✅ Updated search API calls to use POST method with JSON body for complex search parameters
  - ✅ Implemented UI controls for date sorting (relevance, newest first, oldest first)
  - ✅ Added client-side episode filtering with collapsible episode selection interface
  - ✅ Updated search result handling to display total hits and processing time from new Orama `SearchResponse`
  - ✅ Enhanced search controls UI with proper styling consistent with app design
  - ✅ Implemented proper state management for sort options and episode filters
  - ✅ Added episode list sorted by publication date for easy filtering
  - ✅ All TypeScript compilation and build processes successful
  - ✅ Files: `packages/client/src/App.tsx` (major update with new search interface)

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
  sequentialEpisodeIdAsString: 'string', // Sequential episode ID from manifest (as string for Orama filtering)
  startTimeMs: 'number',                // Start time in milliseconds
  endTimeMs: 'number',                  // End time in milliseconds
  episodePublishedUnixTimestamp: 'number', // Unix timestamp for sorting by date
} as const;
```

**Note**: 
- Changed `sequentialEpisodeId` (number) to `sequentialEpisodeIdAsString` (string) for proper Orama array filtering support
- Removed `podcastId`, `episodeTitle`, and `fileKey` from schema to keep index lightweight. These will be handled via client-side filtering using the episode manifest.

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