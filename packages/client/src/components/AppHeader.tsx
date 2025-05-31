import * as React from 'react'
import { Button } from '../components/ui/button'
import ResponsiveDrawerOrDialog from './ResponsiveDrawerOrDialog'
import { ThemeToggle } from './ThemeToggle'

import BlueskyLogo from '../icons/bluesky-logo.svg'

import { InfoCircledIcon, GitHubLogoIcon, GearIcon } from '@radix-ui/react-icons'
import { AudioSourceSelect } from './AudioSourceSelect'

function InfoDrawer() {
  return (
    <ResponsiveDrawerOrDialog
      iconTrigger={<InfoCircledIcon className="size-6" />}
      title="About"
      description="About the application"
      descriptionHidden={true}
    >
      <div>
        <p className="mb-2">
          Find your favorite moments & quotes from the <strong><a href="https://podfollow.com/new-football-cliches" className="underline" target="_blank" rel="noopener noreferrer">Football Clichés</a></strong> podcast.
        </p>
        <p className="mb-2">
          <em>Listen, Fair Play</em> transcribes and indexes all episodes. Select a search result to jump to that point in the audio.
        </p>
        <p>
          The code is fully open source, and available on <a href="https://github.com/jackkoppa/listen-fair-play" className="underline" target="_blank" rel="noopener noreferrer">GitHub</a>.
        </p>
        <br/>
        <p className="mb-2">Something not working? Suggestion for a new feature? Let me know.</p>
        <p>
          <span><GitHubLogoIcon className="size-4 inline-block mr-1" /> <a href="https://github.com/jackkoppa/listen-fair-play/issues/new" className="underline" target="_blank" rel="noopener noreferrer">GitHub</a></span>
          <span className="mx-6">|</span>
          <span><img src={BlueskyLogo} alt="Bluesky Logo" className="size-4 inline-block mr-1" /> <a href="https://bsky.app/profile/jackkoppa.dev" className="underline" target="_blank" rel="noopener noreferrer">Bluesky</a></span>
        </p>
        <p className="mt-6 mb-2 text-sm">
          <em>created by <a href="http://jackkoppa.com" className="underline" target="_blank" rel="noopener noreferrer">Jack Koppa</a></em>
        </p>
      </div>
    </ResponsiveDrawerOrDialog>
  )
}

function SettingsDrawer() {

  return (
    <ResponsiveDrawerOrDialog 
      iconTrigger={<GearIcon className="size-6" />}
      title="Settings" 
      description="App settings and information"
      descriptionHidden={true}
    >
      <div className="w-full pt-4">
        <div className="flex gap-2 text-sm mb-10">
          Theme <ThemeToggle />
        </div>
        <div className="flex flex-col gap-3 text-sm mb-10">
          <div className="flex gap-3">
            <span>Audio<br/>Source</span> 
            <AudioSourceSelect />
          </div>
          <span className="text-[12px]"><strong>Transcribed File</strong> is recommended, to best align transcription with the podcast audio timing.</span>
        </div>
      </div>
    </ResponsiveDrawerOrDialog>
  )
}

interface AppHeaderProps {
  scrolled: boolean;
}

export default function AppHeader({ scrolled }: AppHeaderProps) {

  return (
    <header className={`fixed text-foreground top-0 left-0 right-0 z-20 bg-transparent light:bg-lfp-yellow dark:bg-lfp-blue border-b-2 border-foreground shadow-[0px_4px_0px_rgba(0,0,0,1)]`}>
      <div className={`max-w-3xl mx-auto pr-3 pl-6 flex justify-end gap-2 sm:gap-4 transition-all duration-400 ease-in-out ${scrolled ? 'py-1 xs:py-2' : 'py-2 sm:py-5'}`}>
        <div className="flex flex-col justify-center text-right">
          <h1 className={`font-bold transition-all duration-200 ${scrolled ? 'text-xl xs:text-2xl mb-0' : 'text-2xl xs:text-3xl mb-1'}`}>
            Listen, Fair Play
          </h1>
          <p className={`text-[12px] italic transition-all duration-200 ${scrolled ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100'}`}>
            search the <a href="https://podfollow.com/new-football-cliches" className="underline" target="_blank" rel="noopener noreferrer">Football Clichés</a>
            <br className="xs:hidden" />
            &nbsp;record books
          </p>
        </div>
        <div className={`flex flex-col items-center gap-1 sm:flex-row sm:gap-3 ${scrolled ? 'hidden sm:flex' : ''}`}>
          <InfoDrawer />
          <SettingsDrawer />
        </div>
      </div>
    </header>
  );
} 