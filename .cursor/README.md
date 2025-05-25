TODO: Begin adding the most useful rules here, but only the ones we absolutely need, and only those that can be scoped to specific /packages or areas of the repo

Docs: https://docs.cursor.com/context/rules

# Active Projects

## FlexSearch to Orama Migration
See detailed task list and progress in [FLEXSEARCH_TO_ORAMA_MIGRATION.md](./FLEXSEARCH_TO_ORAMA_MIGRATION.md)

# FlexSearch to New Search Library Migration

## Overview
Replacing FlexSearch with a new search library to support sorting by episode published date and other enhanced search capabilities.

## Task List for FlexSearch Replacement

### Phase 1: Research & Setup
- [ ] **Task 1.1**: Choose replacement search library and document decision
  - Research MiniSearch, Lunr.js, Orama for TypeScript support, sorting capabilities, and performance
  - Test basic indexing and search with episode date sorting
  - Files: Create `research/search-library-comparison.md`

- [ ] **Task 1.2**: Define new search index data structure
  - Design schema that supports date sorting and current search fields
  - Define file format for storing index (JSON, binary, etc.)
  - Files: Update `packages/types/src/search-types.ts`

### Phase 2: Update Dependencies & Core Libraries
- [ ] **Task 2.1**: Update package dependencies
  - Remove `flexsearch` and `sqlite3` from relevant packages
  - Add new search library dependency
  - Remove SQLite Lambda layer if it exists
  - Files: `packages/*/package.json`, deployment configurations

- [ ] **Task 2.2**: Update database utilities
  - Replace `createDocumentIndex` function in `@listen-fair-play/database`
  - Create new index creation and loading utilities
  - Files: `packages/database/src/index.ts`, `packages/database/src/search-index.ts`

### Phase 3: Update Indexing Lambda (Lambda 3)
- [ ] **Task 3.1**: Replace FlexSearch index creation
  - Update `convert-srt-files-into-indexed-search-entries.ts`
  - Replace SQLite DB operations with new index format
  - Maintain existing SRT processing and JSON entry generation logic
  - Files: `packages/ingestion/srt-indexing-lambda/convert-srt-files-into-indexed-search-entries.ts`

- [ ] **Task 3.2**: Update index storage logic
  - Change from SQLite DB file to new index file format
  - Update S3 key constants and file handling
  - Ensure index includes episode metadata for date sorting
  - Files: `packages/constants/src/index.ts`, indexing lambda

- [ ] **Task 3.3**: Test index generation
  - Verify new index format is created correctly
  - Test with existing SRT files and episode manifest
  - Validate index file size and performance
  - Files: Test scripts, sample data

### Phase 4: Update Search Lambda (Lambda 4)
- [ ] **Task 4.1**: Replace FlexSearch query logic
  - Update `search-indexed-transcripts.ts`
  - Implement new search library initialization and querying
  - Maintain existing API interface (`SearchRequest`/`SearchResponse`)
  - Files: `packages/search/search-lambda/search-indexed-transcripts.ts`

- [ ] **Task 4.2**: Add date sorting capabilities
  - Implement sorting by episode published date
  - Support combined relevance + date sorting
  - Maintain existing search features (highlighting, suggestions if possible)
  - Files: Search lambda, search types

- [ ] **Task 4.3**: Update search parameters
  - Add sort options to `SearchRequest` interface
  - Update query parameter handling for GET/POST requests
  - Ensure backward compatibility where possible
  - Files: `packages/types/src/search-types.ts`, search lambda

### Phase 5: Update Client Integration
- [ ] **Task 5.1**: Update client-side search calls
  - Add sorting parameters to search requests from React client
  - Update search result handling if needed
  - Files: `packages/client/src/` (search components)

### Phase 6: Testing & Validation
- [ ] **Task 6.1**: End-to-end testing
  - Test full pipeline: SRT → Index → Search with sorting
  - Verify search results are properly sorted by date
  - Performance testing with existing data volume
  - Files: Test scripts, integration tests

- [ ] **Task 6.2**: Deployment validation
  - Deploy to staging environment
  - Test with production data volume
  - Validate Lambda performance and memory usage
  - Files: Deployment scripts, monitoring

## Key Files for Reference:
- `packages/ingestion/srt-indexing-lambda/convert-srt-files-into-indexed-search-entries.ts`
- `packages/search/search-lambda/search-indexed-transcripts.ts`
- `packages/types/src/search-types.ts`
- `packages/database/src/index.ts`
- `packages/constants/src/index.ts`
- `diagrams/aws-architecture.drawio`

## Current Architecture Notes:
- Lambda 3: Processes SRT files → JSON search entries → Creates search index → Saves to S3
- Lambda 4: Downloads index from S3 → Initializes search → Returns results
- Currently uses FlexSearch with SQLite adapter
- Index stored as `search_index.db` in S3
- Search entries include: id, text, episode metadata

## Requirements:
- Must support sorting by episode published date
- Maintain existing search capabilities (text search, highlighting)
- Keep same Lambda function interfaces
- Remove SQLite dependency
- Optimize for Lambda cold start performance