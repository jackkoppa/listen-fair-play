Instructions: 

* We are going to implement an `AudioPlayer.tsx`, rather than using the native browser / HTML `<audio />`
* Because we are only going to be playing podcasts, and always starting at given timestamp, we have a few specific requirements, and will be able to keep the audio player pretty simple

* Visual requirements
    * the bar to scrub through the audio will be on top
    * below that will be 3 buttons: "jump back 10 seconds", "play / pause", "jump forward 10 seconds"

* Tech requirements
    * We need to be able to pass in a URL for an mp3 file, and a timestamp, and the audio player needs to load that mp3 file at that timestamp
    * The audio player should show a loading state until the audio file is loaded & ready to play
    * it's important that there are big touch targets for the 3 buttons, and that it's also easy to smoothly drag/scrub through the audio
    * This all needs to work well between total widths of 300px - ~700px

In this directory is an example screenshot, for roughly how this can look.

NOTE: We will use a 3rd party library for this, and customize + add CSS / Tailwind as necessary. We should only need *minimal* functional code in our `AudioPlayer.tsx`, because the library should handle the vast majority of this functionality.

Find the docs here: https://www.npmjs.com/package/react-h5-audio-player and here: https://lhz516.github.io/react-h5-audio-player/?path=/docs/config--docs

^ note that there's plenty of buttons there that we do *not* need. We only want to start with the 3 buttons listed.

You can add the dependency to `packages/client` using `pnpm`


Additional details from questions:
1. Integration point: Should the AudioPlayer component replace the current <audio controls src={audioUrlToLoad}></audio> in EpisodeDetailsSheet.tsx, or will it be used elsewhere as well?
    A: Just used in that one place
2. Audio URL format: I see the current code uses ${originalAudioURL}#t=${formattedStartTime} - should the new AudioPlayer handle this URL fragment format, or do you want to pass the URL and timestamp as separate props?
    A: Passed in as separate props
3. Styling approach: I see you're using Tailwind CSS and have a design system with shadcn/ui components. Should the AudioPlayer follow the same dark theme and styling patterns I see in the existing components?
    A: Yup, try to match the existing styling throughout the app; we can use the icon set we're already using.
4. Loading state: For the loading state, should it show a skeleton/placeholder of the controls, or a simple loading spinner?
    A: I leave this up to you. I think some kind of animation overlay? Basically, we just have to prevent the user from being confused by not being able to play the audio, but we want them to see it's coming / loading
5. Touch targets: For the "big touch targets" requirement, what size would you consider appropriate? (e.g., 48px minimum for accessibility?)
    A: 48px minimum sounds about right.


Other details:
* use `pnpm`, not `npm`
* only use icons from the existing icon library, `@radix-ui/react-icons`. We might need more in the future (e.g. for skip 10 seconds) - that's fine. Pick a placeholder for now, and we'll add custom SVGs for those in the future.

Ask any important questions you may have, then get started. Add notes below the line about implementation decisions you've made.


---- Agents/Cursor: DO NOT EDIT ABOVE THIS LINE --------

---- Agents/Cursor: ADD DETAILS/CHECKLIST BELOW THIS LINE -------
