# Instructions

## UPDATE from user

We have completed Phases 1-7.
However, I'm still not happy with the jumpiness of the experience, with things sometimes briefly loading, only to then be replaced.
So we're going to simplify it. We will only make searches when the user presses "Enter" from while in the search input, and/or clicks the magnifying glass button.

Please thoroughly process all the relevant files mentioned in this doc, as well as what we've done so far. Then, write an implementation plan, starting with Phase 8 at the bottom (it may only need to be a few more phases). Then let the user review the plan before we proceed.

Some notes:
* We'll move the magnifying glass from the left of the input, to an icon <Button> on the right of the input
* We should simplify the code *as much as possible* - we can remove debouncing, some of the complex loading logic, etc.
    * We still have to account for `ColdStartLoader`, because a user might type a search term & hit search before we've gotten back a healthy `isLambdaWarm`. 
    * But that's a lot less likely now, so let's also add a new check there. We'll set an estimated const, `ESTIMATED_TIME_FOR_LAMBDA_COLD_START`, starting at 10 seconds. If it's already been 10 seconds since the user first loaded the page & we kicked off the health check, don't bother showing the `ColdStartLoader` UI. We'll just let our normal loading spinner + skeleton components take care of that
    

## Original instructions (note: these have already been completed in Phases 1-7 below)

We will be working on significantly improving the UX for users:
1. First landing on the app, and performing their first search
2. Performing subsequent searches

Here are rough outlines for the changes we'll make, and the rationale:

A. Currently, when most users land on http://listenfairplay.com/ and attempt to perform their first search, they experience ~10-15 seconds of waiting before they get their first results. This is because of our Lambda setup - if the Lambda is starting cold, then it needs to retrieve the existing Orama search DB file from S3, and this takes awhile. Because we initialize the Orama search DB from the file *outside of* the `handler()` function, all subsequent calls are quite fast - between 5 & 1500ms, depending on search complexity. That speed is plenty fast to handle with just a spinner on the search input & nothing more - so a better loading UX for that first call is what we're particularly focused on here
    *A.1.* Note: We will likely *eventually* add a EventBridge trigger to keep the search Lambda warm during regular US hours (e.g. call it every 5-15 minutes, from 7am - 11:30pm ET, something like that). We can eventually add a plan for how to do that in `./ADD_CONFIGURABLE_SCHEDULED_TRIGGER_TO_KEEP_SEARCH_LAMBDA_WARM.md`. However, we are *not* doing that now, and it's essential that we gracefully handle the case of the slow startup time regardless - we'll sometimes turn off that "keep warm" trigger, and UX when hitting the cold start needs to be enjoyable.

B. So to improve on this, let's review & improve the loading logic in App.tsx & elsewhere. 

C. Let's start by adding a way to call the search Lambda that will *only* trigger the Lambda to run its init portion, and then immediately return. Probably something like calling a `/health` URL, or perhaps more simply, adding a `isHealthCheckOnly` property to the request object. If present, the Lambda handler should immediately return a success code, rather than trying to perform a search in the handler. This way, we'll now have a way to get the Lambda started *before* we perform any search - i.e., as soon as a user opens the React app, we can make this call

D. Then update the React app to make this call immediately upon first initializing. Hopefully, a lot of times, it returns almost immediately because the Lambda is warm. But either way, we'll use this call - on every app initialization - to set a value called something like `isLambdaWarm`.

E. If a user starts typing a search entry while the above property (`isLambdaWarm`) is still false, then immediately fade into our new loading experience. We'll call this the Lambda Cold Start Loading UI, or just `ColdStartLoader.tsx`
    * This view should fade in, and show one quote at a time from below. Each quote should display for (make this a CONSTANT we can adjust) 7 seconds. After 7 seconds, that quote fades & the next one fades in 
    * They should display in a visually appealing way
    * They should link to their route, so that users *could* click to view that quote in the `/episode` route
    * Above the quote, display very brief & small helper text explaining what's happening. Something like this, language should be light & easy in tone: "Starting up search... enjoy some Clichés favorites in the meantime"
    * As soon as the `health` endpoint comes back successfully, and `isLambdaWarm` is now true, then we can perform the real search for what the user has typed. Once we've gotten *that* result, we can finally fade out `ColdStartLoader.tsx`, to show the real search results


F. A-E should mostly cover #1 - "First landing on the app, and performing their first search"

G. We also want to improve #2 - "Performing subsequent searches". The main enhancement here is that things are too jumpy right now. Subsequent searches (once the Lambda is warm) only take ~500ms on average, so showing the loading spinner is plenty of indication that a search is being performed. We could also add a https://ui.shadcn.com/docs/components/skeleton, or something similar, in place of the values for "how long the search has taken" & "hits" above the results. 
    * Small UI fix let's add to this: right now, those 2 values, plus the "sort by" dropdown, take up too much space. Let's fix that - one idea is to stack those 2 values on the left side above the search results (pretty small text), and put the sort by dropdown on the right

H. We can update the current way that we force a user to type two characters. Let's continue to start with a blank screen with only the search input when the user visits the page, and let's also continue to clear out search results & go back to only the search input if they've already searched. But if the user focuses the input, and then exits with either no characters, or only one (i.e. less than 2 characters required to trigger a search), let's just add small, muted gray text below the input explaining at least two characters are needed
    * It's important that the jumpiness when searching goes away - if a user is typing, and one search does complete while they're still typing, don't update the search results until they're finished typing (i.e. at least ~500ms since last key entry), and we've had the chance to finish that search. Then go ahead & display the results. We want to prevent, for example, typing "corri" - the search finishing for that, and user seeing a flash no results - then the user finishing what they were already typing, "corridor of uncertainty", and getting results. We want to prevent those flashes of content.





## Additional guidance: see [PERMANENT--ADDITIONAL_GUIDANCE.md](./PERMANENT--ADDITIONAL_GUIDANCE.md) - **IMPORTANT**





Example quotes that we'll use for the loading section:

1. https://listenfairplay.com/episode/46?q=sucks+ball&start=1731100
"I mean, The Kop holds, in its current form, it holds about 12,000 people. 12,000 sucks, you could move a Premier League issue football, a standard Premier League match ball, maybe an inch, maybe an inch and a half."

- Football chants you don't hear any more, with Elis James


2. https://listenfairplay.com/episode/130?q=come+what+February&start=746640
"I would go as far to say now, Dave, that come what February should now be the official tagline for the Carabao Cup. The Carabao, come what February."

- "Come what February", Pep vs Pat and Lukaku's bangers


3. https://listenfairplay.com/episode/336?q=Southampton%2C+that+championship+final&start=397040
"Brilliant for the football club, obviously. You know, having been at the football club 10 years ago, I've still got, you know, a soft spot for the football club."

- The Adjudication Panel: Mourinho in Turkey, 71 billion calories & a football club every 2.24 seconds



## Answers to initial questions from Agent

A few quick clarifications:
1. Should the quotes in ColdStartLoader.tsx be clickable links that navigate to the episode page (maintaining current search params), or just visual content?
    A: They should be actual clickable links, likely using react-router navigate, to open up the correct `/episode` URLs given above
2. For the UI reorganization in point G, do you want the "search time" and "hits" info stacked vertically on the left, with "sort by" on the right, all in a single row?
    A: Yup, that's correct.
Should I proceed with adding the health check using a query parameter like ?healthCheck=true or would you prefer a separate /health endpoint?
    A: I don't need it to be a separate endpoint, a param is fine


## Answers to follow-up questions:
For the UI reorganization in Phase 5 - You mentioned stacking "search time" and "hits" on the left side and putting "sort by" on the right. Looking at the current SearchResults component, I see these are currently in a flex layout with time on the left and hits on the right. Should the new layout look like:
```
   [Search time: Xms]     [Sort by: dropdown]
   [Showing: X of Y hits]
```
    A: Yup! That's how it should look, but the sort by dropdown should be roughly the height of those two text lines combined

For the 500ms debounce in Phase 5 - I see there's already a 300ms debounce for search API calls in HomePage.tsx. Are you asking to:
Increase this from 300ms to 500ms, OR
Add a separate 500ms debounce specifically for preventing UI updates while typing?
    A: Increase this from 300ms to 500ms
For the minimum character requirement UX in Phase 6 - Should the helper text appear:
Only when the input is focused and has less than 2 characters, OR
Anytime the input has less than 2 characters (focused or not)?
    A: Should appear only once the user has actually focused the field, and then unfocused it. If the user has not yet focused the field: no helper text. If they are still focused & potentially typing, no helper text. Only once they've focused & then blurred



* Once you've finished reading all the above & processing all relevant files, then proceed onto the Implementation Checklist.


---- AGENTS, DO NOT EDIT ABOVE THIS LINE -------

---- AGENTS, EDIT BELOW THIS LINE, INCLUDING ALWAYS UPDATING THE CHECKLIST ----

## Implementation Checklist

### Phase 1: Add Health Check to Search Lambda ✅ COMPLETED
- [x] Add `isHealthCheckOnly` parameter to `SearchRequest` type in `packages/types/search.ts`
- [x] Modify search Lambda handler in `packages/search/search-lambda/search-indexed-transcripts.ts` to check for health check parameter and return early
- [x] Update dev server in `packages/search/search-lambda/dev-server.ts` to handle health check requests
- [x] Create `performHealthCheck` utility function in `packages/client/src/utils/search.ts`

### Phase 2: Add Lambda Warmup Logic to React App ✅ COMPLETED
- [x] Add `isLambdaWarm` state and health check logic to `packages/client/src/routes/HomePage.tsx`
- [x] Call health check immediately on app initialization
- [x] Add debouncing logic to prevent multiple health check calls

### Phase 3: Create Cold Start Loader Component ✅ COMPLETED
- [x] Create `packages/client/src/components/ColdStartLoader.tsx` with quote rotation functionality
- [x] Add constants for quote display duration (7 seconds)
- [x] Include the three example quotes from instructions with proper episode links
- [x] Style component to match app's visual design (border, shadow, etc.)

### Phase 4: Integrate Cold Start Loader with Search Flow ✅ COMPLETED
- [x] Modify `HomePage.tsx` to show `ColdStartLoader` when user starts typing but Lambda is not warm
- [x] Hide cold start loader when health check completes and real search results arrive
- [x] Update search triggering logic to respect Lambda warm state

### Phase 5: Improve Subsequent Search Experience ✅ COMPLETED
- [x] Add skeleton loading states to `packages/client/src/components/SearchResults.tsx`
- [x] Reorganize search info layout: stack "search time" and "hits" on left, "sort by" on right
- [x] Prevent search result updates while user is still typing (500ms debounce)
- [x] Update `packages/client/src/components/SearchControls.tsx` layout

### Phase 6: Improve Minimum Character Requirement UX ✅ COMPLETED
- [x] Add helper text below search input when user has less than 2 characters
- [x] Modify `packages/client/src/components/SearchInput.tsx` to show muted gray text
- [x] Update focus/blur handling for better UX

### Phase 7: Add Tests ✅ COMPLETED
- [x] Create Vitest spec for `ColdStartLoader.tsx` component
- [x] Create Vitest spec for new health check functionality
- [x] Test loading states and transitions

### Phase 8 (& possibly more): Convert Search to be Only on Enter/Button Click - not as-you-type