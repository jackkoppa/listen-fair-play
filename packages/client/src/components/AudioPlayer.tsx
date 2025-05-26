import React, { useRef, useEffect, useState } from 'react';
import H5AudioPlayer, { RHAP_UI } from 'react-h5-audio-player';
import 'react-h5-audio-player/lib/styles.css';
// import { FiPlay, FiPause, FiRewind, FiFastForward } from 'react-icons/fi'; // Using react-icons for now
import { PlayIcon, PauseIcon, ReloadIcon, TrackNextIcon } from '@radix-ui/react-icons';
import { Button } from './ui/button'; // For consistent button styling
import { cn } from '@/lib/utils'; // For utility classnames

interface AudioPlayerProps {
  audioUrl: string;
  startTime: number; // in seconds
}

const CustomAudioPlayer: React.FC<AudioPlayerProps> = ({ audioUrl, startTime }) => {
  const playerRef = useRef<H5AudioPlayer>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    if (playerRef.current?.audio.current) {
      const audio = playerRef.current.audio.current;
      
      const handleLoadedMetadata = () => {
        if (audio.readyState >= 1) { // HAVE_METADATA
          audio.currentTime = startTime;
        }
        // setIsLoading(false); // Let canplay handle this
      };

      const handleCanPlay = () => {
        setIsLoading(false);
        setError(null);
      };

      const handleError = (e: Event) => {
        console.error("Error loading audio:", e);
        // The error event on HTMLMediaElement doesn't provide much detail.
        // We can get more from audio.error
        let errorMsg = "Error loading audio.";
        if (audio.error) {
            switch (audio.error.code) {
                case MediaError.MEDIA_ERR_ABORTED:
                    errorMsg = "Audio playback aborted.";
                    break;
                case MediaError.MEDIA_ERR_NETWORK:
                    errorMsg = "A network error caused the audio download to fail.";
                    break;
                case MediaError.MEDIA_ERR_DECODE:
                    errorMsg = "The audio playback was aborted due to a corruption problem or because the audio used features your browser did not support.";
                    break;
                case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
                    errorMsg = "The audio could not be loaded, either because the server or network failed or because the format is not supported.";
                    break;
                default:
                    errorMsg = "An unknown error occurred while loading the audio.";
                    break;
            }
        }
        setError(errorMsg);
        setIsLoading(false);
      };

      // Reset and load new audio
      // Setting src directly and calling load() is more reliable for some browsers/scenarios
      audio.src = audioUrl;
      audio.load();


      audio.addEventListener('loadedmetadata', handleLoadedMetadata);
      audio.addEventListener('canplay', handleCanPlay);
      audio.addEventListener('error', handleError);
      

      return () => {
        audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
        audio.removeEventListener('canplay', handleCanPlay);
        audio.removeEventListener('error', handleError);
        // Optional: pause and reset src when component unmounts or audioUrl changes
        // audio.pause();
        // audio.removeAttribute('src');
        // audio.load();
      };
    }
  }, [audioUrl, startTime]);


  const handlePlayPause = () => {
    if (playerRef.current?.audio.current) {
      const audio = playerRef.current.audio.current;
      if (isPlaying) {
        audio.pause();
      } else {
        audio.play().catch(e => {
            console.error("Error playing audio:", e);
            setError("Could not play audio.");
        });
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleJumpForward = () => {
    if (playerRef.current?.audio.current) {
      playerRef.current.audio.current.currentTime += 10;
    }
  };

  const handleJumpBackward = () => {
    if (playerRef.current?.audio.current) {
      playerRef.current.audio.current.currentTime -= 10;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center w-full max-w-2xl p-4 bg-background rounded-lg border">
        {/* Consistent loading spinner using Tailwind CSS */}
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
        <span className="ml-3 text-muted-foreground">Loading audio...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center w-full max-w-2xl p-4 bg-background rounded-lg border border-destructive">
        <span className="text-destructive-foreground text-sm">{error}</span>
        <Button variant="outline" size="sm" onClick={() => {
             if (playerRef.current?.audio.current) {
                playerRef.current.audio.current.load(); // Try to reload
                setIsLoading(true);
                setError(null);
             }
        }} className="mt-2">
            Try Again
        </Button>
      </div>
    );
  }

  return (
    // Using card styles for consistency with shadcn/ui
    <div className="w-full max-w-2xl bg-card text-card-foreground p-4 rounded-lg border shadow-sm">
      <style>{`
        .custom-audio-player-styles .rhap_progress-section {
          margin-bottom: 0.5rem; // Add some space between progress bar and controls
        }
        .custom-audio-player-styles .rhap_progress-bar {
          height: 8px;
          border-radius: 4px;
        }
        .custom-audio-player-styles .rhap_progress-filled {
          background-color: hsl(var(--primary));
          border-radius: 4px;
        }
        .custom-audio-player-styles .rhap_progress-indicator {
          background: hsl(var(--primary-foreground));
          border: 2px solid hsl(var(--primary));
          box-shadow: 0 0 2px 1px hsla(var(--primary), 0.5);
          width: 16px;
          height: 16px;
          top: -4px; // Adjust to center on the 8px bar
        }
        .custom-audio-player-styles .rhap_main-controls-button {
            color: hsl(var(--foreground));
            font-size: 24px; /* Ensure icons are large enough */
            width: 48px; /* Ensure touch targets */
            height: 48px;
        }
        .custom-audio-player-styles .rhap_button-clear {
            padding: 0; /* Remove default padding if we use our buttons */
        }
        /* Hide default player controls if we are fully custom */
        .custom-audio-player-styles .rhap_additional-controls,
        .custom-audio-player-styles .rhap_volume-controls {
            display: none;
        }
      `}</style>
      <H5AudioPlayer
        ref={playerRef}
        // src={audioUrl} // src is set in useEffect to ensure it reloads properly with startTime
        autoPlayAfterSrcChange={false} 
        onPlayError={(e) => {
            console.error("onPlayError", e);
            setError("Error trying to play audio.");
            setIsPlaying(false);
        }}
        onPlay={() => {setIsPlaying(true); setError(null);}}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)} 
        layout="stacked-reverse" 
        customProgressBarSection={[
          RHAP_UI.PROGRESS_BAR,
        ]}
        customControlsSection={[]} // We use our own div for controls
        showSkipControls={false}
        showJumpControls={false} 
        showDownloadProgress={true} // Keep this for better UX on loading bar
        showFilledProgress={true}
        className="custom-audio-player-styles"
      />
      <div className="flex justify-around items-center mt-1"> {/* Reduced margin-top as progress bar has margin-bottom */}
        <Button 
          variant="ghost"
          size="icon"
          onClick={handleJumpBackward} 
          className="w-12 h-12" // 48px
          aria-label="Jump back 10 seconds"
        >
          <ReloadIcon className="w-6 h-6" /> {/* Using ReloadIcon as placeholder */}
        </Button>
        <Button 
          variant="ghost"
          size="icon"
          onClick={handlePlayPause} 
          className="w-12 h-12 mx-2" // 48px
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <PauseIcon className="w-7 h-7" /> : <PlayIcon className="w-7 h-7" />}
        </Button>
        <Button 
          variant="ghost"
          size="icon"
          onClick={handleJumpForward} 
          className="w-12 h-12" // 48px
          aria-label="Jump forward 10 seconds"
        >
          <TrackNextIcon className="w-6 h-6" /> {/* Using TrackNextIcon as placeholder */}
        </Button>
      </div>
    </div>
  );
};

export default CustomAudioPlayer;
