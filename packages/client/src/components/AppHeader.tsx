import { useState } from 'react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '../components/ui/sheet'
import { Button } from '../components/ui/button'
import { HamburgerMenuIcon } from '@radix-ui/react-icons'
import { MoonIcon, SunIcon, GitHubLogoIcon } from '@radix-ui/react-icons'
import { useTheme } from '../hooks/useTheme'

interface AppHeaderProps {
  scrolled: boolean;
}

export default function AppHeader({ scrolled }: AppHeaderProps) {
  const [isNavOpen, setIsNavOpen] = useState(false)
  const { theme, toggleTheme } = useTheme()

  return (
    <header className={`fixed top-0 left-0 right-0 z-20 bg-secondary border-b-2 border-foreground shadow-[0px_4px_0px_rgba(0,0,0,1)] transition-all duration-300 ease-in-out ${scrolled ? 'py-2' : 'py-4'}`}>
      <div className="max-w-3xl mx-auto px-6 flex justify-between items-center">
        {/* Left: Hamburger Menu */}
        <Sheet open={isNavOpen} onOpenChange={setIsNavOpen}>
          <SheetTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon"
              className={`transition-all duration-200 ${scrolled ? 'size-8' : 'size-10'}`}
            >
              <HamburgerMenuIcon className={`transition-all duration-200 ${scrolled ? 'size-5' : 'size-6'}`} />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80 sm:max-w-80">
            <SheetHeader>
              <SheetTitle>Menu</SheetTitle>
              <SheetDescription>
                App settings and information
              </SheetDescription>
            </SheetHeader>
            
            <div className="mt-6 space-y-6">
              {/* Theme Toggle Section */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium">Theme</h3>
                <Button
                  variant="outline"
                  onClick={toggleTheme}
                  className="w-full justify-start gap-2"
                >
                  {theme === 'light' ? (
                    <>
                      <MoonIcon className="size-4" />
                      Switch to Dark Mode
                    </>
                  ) : (
                    <>
                      <SunIcon className="size-4" />
                      Switch to Light Mode
                    </>
                  )}
                </Button>
              </div>

              {/* About Section */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium">About</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Search through Football Clichés podcast transcripts to find your favorite moments and quotes. 
                  Discover the beautiful game's most memorable commentary.
                </p>
                
                <div className="space-y-2">
                  <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Feedback</h4>
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="justify-start gap-2 h-8"
                      asChild
                    >
                      <a 
                        href="https://github.com/jackkoppa/listen-fair-play/issues/new?labels=enhancement&template=feature_request.md" 
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        <GitHubLogoIcon className="size-3" />
                        Request Feature
                      </a>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="justify-start gap-2 h-8"
                      asChild
                    >
                      <a 
                        href="https://github.com/jackkoppa/listen-fair-play/issues/new?labels=bug&template=bug_report.md" 
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        <GitHubLogoIcon className="size-3" />
                        Report Bug
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* Right: Title and Subtitle */}
        <div className="text-right flex-1 ml-4">
          <h1 className={`font-bold text-secondary-foreground transition-all duration-200 ${scrolled ? 'text-xl mb-0' : 'text-2xl mb-1'}`}>
            Listen, Fair Play
          </h1>
          <p className={`text-xs text-secondary-foreground italic transition-all duration-200 ${scrolled ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100'}`}>
            search the <a href="https://podfollow.com/new-football-cliches" className="underline" target="_blank" rel="noopener noreferrer">Football Clichés</a> record books
          </p>
        </div>
      </div>
    </header>
  );
} 