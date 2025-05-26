# Instructions

We will be working to add react-router to the application, with 2 primary routes we want to add:

1. Allowing query params for search filters, on the home page (e.g. `?q='the current query'`, and `sort=A` (sorting))

2. Adding a `listenfairplay.com/episode` route, which will load the `EpisodeDetailsSheet.tsx` component. That route will have query params like `eID=THE_EPISODE_ID` and `start=START_TIME_IN_MS`.


There will be refactoring to do such that react-router query params are the source of truth/state for the above values. The most important usage is navigating directly to these URLs, with query params applied, and the application initializing itself correctly. We'll have to refactor various components to make sure this all works. Some details/further requirements to consider:

* The application client-side code is served via an `index.html` in S3, behind a CloudFront distribution. Let's make sure our routing configuration will still work correctly, even if someone navigates to `/episode` directly. We will *not* be adding a server, so all routing needs to work with whatever generated static files we upload to S3
    * See `/terraform/main.tf` for the entry point of how S3 + CloudFront is configured
* Use the latest version of https://www.npmjs.com/package/react-router (looks like 7.6.1)
* Use `pnpm` to install dependencies
* We can use `pnpm client:dev` if we need to check how something is working, but do not do this yourself - if it's time to test how something is working, stop working, and prompt the user to check on specific behaviors / UI screens. I'll run that myself.
* Add at least one Vitest spec to test routing - this can be done late in the work
    * `cd packages/client && pnpm test` to run those tests
* `cd packages/client && pnpm build` to test the build
* Error handling for failed network requests will remain important. That should be done with inline (in-UI) error messages, the way it's already done
* Examine the existing app *very carefully*, before making any decisions about how to implement this.
* Once a decision on implementation is made, add the plans below. They should be a checklist, with steps/phases to mark as completed as we go. It should be as succinct as possible, while also including the file names/paths that would be needed by a future agent to fully understand the context of the changes
    * Before adding the initial implementation checklist below, prompt the user if you have any urgent questions/clarification that you need
* When implementing the checklist, *always* stop after completing each step, and prompt the user to check the work, and see if they want to make any adjustments. Don't just continue onto the next step/phase.
* Existing functionality should continue working - e.g. clicking `Load Here` should continue to open the `EpisodeDetailsSheet.tsx`, loaded at the appropriate timestamp, with the full transcript also displayed, and the UI scrolled to that timestamp in the transcript. This should now just be triggered by navigating to the correct react-router `/episode` route, with the correct query params applied
* You may need more than the 4 query params described so far, but that's *most* or all of what you need. We'll likely add future query params for future features.
* Always update the checklist below as steps are completed, with any absolutely required additional details


Answers to initial implementation questions:

1. Episode ID Parameter: For the /episode route, should the eID parameter be the sequentialId from the episode manifest, or the search result id? The search result id is unique per transcript segment, while sequentialId identifies the episode.
    A: Should be the `sequentialEpisodeIdAsString` from the search result. Which is the same as `sequentialId` from the manifest, but the search result is how you'll get it. This needs to identify the episode, since that id is a permalink per episode. Then when we load `/episode`, it will also have the `?start` param - that's how we'll know which spot in the transcript has been selected/should be highlighted
Route Structure: Should the episode route be /episode or /episodes (plural)? The instructions mention both.
    A: Good question. It should be `/episode`, since we're viewing a single episode in that Sheet
Query Parameter Names: You mentioned eID and start - should I also include a parameter for the specific search result ID to highlight the correct transcript segment, or should start time be sufficient to find the matching segment?
    A: See above - start time will be sufficient
Backward Compatibility: When implementing the router, should the existing "Load Here" button behavior change immediately to use navigation, or should we maintain both approaches during a transition period?
    A: Nope, no existing users that we need to worry about. Transition immediately to the new approach, and remove any old code that's no longer necessary

---- AGENTS, DO NOT EDIT ABOVE THIS LINE -------

---- AGENTS, EDIT BELOW THIS LINE, INCLUDING ALWAYS UPDATING THE CHECKLIST ----

## Implementation Checklist

### (✅ COMPLETE) Phase 1: Install Dependencies and Setup Router Foundation
- [x] Install React Router v7.6.1 via `pnpm add react-router@7.6.1` in `packages/client/`
- [x] Update Vite config (`packages/client/vite.config.ts`) to handle client-side routing in dev mode
- [x] Create router setup in `packages/client/src/main.tsx` with BrowserRouter
- [x] Create route components structure in `packages/client/src/routes/`

### (✅ COMPLETE) Phase 2: Create Route Components with Nested Structure
- [x] Create `packages/client/src/routes/HomePage.tsx` - extract current App.tsx search functionality
- [x] Create `packages/client/src/App.tsx` router configuration with nested routes: `/` and `/episode/:eID`
- [x] Update `HomePage.tsx` to render `<Outlet />` for child routes (episode sheet overlay)
- [x] Create episode route component that renders `EpisodeDetailsSheet` using `eID` route parameter
- [x] Add redirect from `/episode` (without eID) to `/` for invalid routes

### Phase 3: Implement URL State Management for Home Page
- [ ] Add URL query param sync for search query (`q` parameter) in `HomePage.tsx`
- [ ] Add URL query param sync for sort option (`sort` parameter) in `HomePage.tsx`  
- [ ] Add URL query param sync for selected episode filters (`episodes` parameter) in `HomePage.tsx`
- [ ] Update search functionality to read from URL params on page load
- [ ] Ensure URL updates when search state changes (debounced)

### Phase 4: Implement Episode Sheet with Route and Query Parameters
- [ ] Create episode route component to read `eID` route parameter and `start` query parameter
- [ ] Fetch episode data by `eID` from episode manifest (simultaneous with home page search loading)
- [ ] Fetch full episode transcript data independently of search results
- [ ] Create mock search result from `start` time parameter for transcript highlighting
- [ ] Keep `EpisodeDetailsSheet` as a Sheet component (overlay behavior preserved)
- [ ] Handle error states for invalid episode IDs or missing data
- [ ] Implement sheet close behavior to navigate back to `/` (preserving search query params, removing start param)

### Phase 5: Update Navigation and Preserve Sheet Behavior
- [ ] Update "Load Here" button in `SearchResult.tsx` to navigate to `/episode/:eID` with current query params plus start param
- [ ] Ensure `EpisodeDetailsSheet` remains as a Sheet component (no removal of Sheet wrapper)
- [ ] Update sheet close handlers to use React Router navigation back to `/`
- [ ] Test that search query parameters coexist with episode route parameters

### Phase 6: Testing and Build Configuration
- [ ] Create Vitest test file `packages/client/src/routes/__tests__/routing.test.tsx`
- [ ] Test navigation between routes and URL parameter handling
- [ ] Test build process with `cd packages/client && pnpm build`
- [ ] Verify that direct navigation to `/episode` URLs works correctly

### Phase 7: Final Integration and Cleanup
- [ ] Test all existing functionality still works (search, filtering, episode loading)
- [ ] Verify URL sharing works correctly (copy/paste URLs with state)
- [ ] Test browser back/forward navigation
- [ ] Remove any dead code and update imports
- [ ] Update any relevant documentation

## Key Files to Modify:
- `packages/client/package.json` - Add react-router dependency
- `packages/client/vite.config.ts` - Router dev support (no changes needed)
- `packages/client/src/main.tsx` - Router setup
- `packages/client/src/App.tsx` - Nested route configuration
- `packages/client/src/routes/HomePage.tsx` - Home page with URL state and Outlet for child routes
- `packages/client/src/routes/EpisodeRoute.tsx` - Episode route component (renders EpisodeDetailsSheet)
- `packages/client/src/components/SearchResult.tsx` - Update navigation to preserve all query params
- `packages/client/src/components/EpisodeDetailsSheet.tsx` - Update close handlers to use React Router
- `packages/client/src/routes/__tests__/routing.test.tsx` - Tests

## Route Structure and Parameters:

**Routes:**
- `/` - Home page with search functionality
- `/episode/:eID` - Same home page + EpisodeDetailsSheet overlay
- `/episode` (without eID) - Redirects to `/` (invalid route)

**Query Parameters:**
- `q` - search query string (preserved across routes)
- `sort` - sort option ('relevance', 'newest', 'oldest') (preserved across routes)
- `episodes` - comma-separated list of episode IDs for filtering (preserved across routes)
- `start` - start time in milliseconds for transcript highlighting (episode route only)

**Route Parameters:**
- `eID` - episode sequential ID (from `sequentialEpisodeIdAsString`) in `/episode/:eID`

**Navigation Behavior:**
- Home to Episode: Navigate to `/episode/:eID?start=X&q=Y&sort=Z&episodes=A,B,C`
- Episode to Home: Navigate to `/?q=Y&sort=Z&episodes=A,B,C` (preserves search state, removes episode-specific params)
- Direct Episode URL: Loads home page + episode sheet simultaneously