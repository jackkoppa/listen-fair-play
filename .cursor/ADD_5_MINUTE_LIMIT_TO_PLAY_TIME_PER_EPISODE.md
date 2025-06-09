# Summary

We want to add a limit (starting with a limit of 5 minutes) to how much audio can be played, during a given session (sessionStorage), for a given episode.

When audio is played, we should track total duration played for each episode (can be just in memory normally), and update a value in session storage each time play/pause/skip backward/skip forward is pressed. 

Once the value goes about the limit, then we automatically:
1. Pause the audio
2. Pull up a `packages/client/src/components/ResponsiveDrawerOrDialog.tsx`
    A. In that, explain to the user that they've hit the audio limit for that episode. They can listen to the rest of the episode, in their podcast player of choice. Or, continue on this site to search across other episodes (feel free to adjust this phrasing)
    B. that dialog includes the link as an action button, clicking the button will open the link
    C. For now, just use this link: https://podfollow.com/new-football-cliches

3. Then, for the rest of the session, the play button stays disabled for that episode, and the audio cannot be played.

4. If a user visits again (new session), then their count will obviously start from 0 for every episode.


Ask any questions you have, then start on the Implementation plan




--- AGENTS: DO NOT EDIT ABOVE THIS LINE. EDIT BELOW THIS LINE TO TRACK IMPLEMENTATION PLAN. BE AS SUCCINCT AS POSSIBLE, WHILE INCLUDING REFERENCES TO ALL NECESSARY FILES ---

# Implementation

## Files to Create/Modify:

### 1. Created: `packages/client/src/hooks/usePlayTimeLimit.ts`
- Tracks play time per episode using episodeId as key
- Stores totals in sessionStorage with prefix `episode_play_time_`
- Updates play time every second during playback
- Manages limit exceeded state (5min = 300,000ms)
- Provides callbacks: onPlay, onPause, onSeek, checkAndHandleLimit

### 2. Created: `packages/client/src/components/PlayTimeLimitDialog.tsx`
- Uses Dialog/Drawer components directly for external state control
- Shows limit exceeded message with episode title
- Action button linking to https://podfollow.com/new-football-cliches  
- Responsive design (dialog on desktop, drawer on mobile)

### 3. Modified: `packages/client/src/components/AudioPlayer/AudioPlayer.tsx`
- Added episodeId and isLimitExceeded props
- Added onPause and onSeek callback props
- Disabled controls when limit exceeded (pointer-events-none + opacity)
- Prevents play action when limit exceeded
- Calls tracking callbacks on play/pause/seek events

### 4. Modified: `packages/client/src/routes/EpisodeRoute.tsx`
- Imported usePlayTimeLimit hook and PlayTimeLimitDialog
- Added limit tracking handlers (handlePlay, handlePause, handleSeek)
- Integrated limit checking in handleListen for auto-pause
- Shows PlayTimeLimitDialog when limit exceeded
- Passes episodeId and limit state to AudioPlayer

## Key Integration Points:
- Episode identification: `episodeData.sequentialId.toString()`
- Limit detection triggers dialog + audio pause
- Session storage persists across page refreshes
- New session resets all counters