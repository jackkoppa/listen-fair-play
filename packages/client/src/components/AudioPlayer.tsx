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
  // Initialize isLoading to true; it will be set to false onCanPlay or onError
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  console.log(`CustomAudioPlayer render/re-render. Key will be: ${audioUrl}, Current isLoading: ${isLoading}`);

  // Effect to reset states when audioUrl changes (primarily for when the component is re-used without a key change, though key should dominate)
  useEffect(() => {
    console.log(`useEffect[audioUrl]: New URL "${audioUrl}". Setting isLoading=true, error=null.`);
    setIsLoading(true);
    setError(null);
    // The key change on H5AudioPlayer should handle re-initialization and loading.
  }, [audioUrl]);

  const handleLoadedMetadata = (event: Event) => {
    const audio = event.currentTarget as HTMLAudioElement;
    console.log(`onLoadedMetaData: readyState=${audio.readyState}, duration=${audio.duration}, src="${audio.src}"`);
    if (audio.readyState >= audio.HAVE_METADATA && startTime >= 0 && audio.duration > 0) {
      // Ensure startTime is not greater than duration
      audio.currentTime = Math.min(startTime, audio.duration - 0.1); // -0.1 to avoid issues at the very end
      console.log(`onLoadedMetaData: currentTime set to ${audio.currentTime}`);
    }
  };

  const handleCanPlay = (event: Event) => {
    const audio = event.currentTarget as HTMLAudioElement;
    console.log(`onCanPlay: Audio can play. src="${audio.src}", currentTime=${audio.currentTime}`);
    setIsLoading(false);
    setError(null);
  };

  const handleError = (event: Event) => {
    const audio = event.currentTarget as HTMLAudioElement;
    console.error("H5AudioPlayer onError (from audio element):", audio.error);
    let errorMsg = "Error loading audio.";
    if (audio.error) {
        switch (audio.error.code) {
            case MediaError.MEDIA_ERR_ABORTED: errorMsg = "Playback aborted."; break;
            case MediaError.MEDIA_ERR_NETWORK: errorMsg = "Network error fetching audio."; break;
            case MediaError.MEDIA_ERR_DECODE: errorMsg = "Error decoding audio."; break;
            case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED: errorMsg = "Audio format not supported or source error."; break;
            default: errorMsg = `Unknown audio error (code: ${audio.error.code}).`; break;
        }
    } else if (!audio.src || audio.src === window.location.href) {
        errorMsg = "Invalid audio source provided."; // Check if src is not set or points to the page itself
    }
    setError(errorMsg);
    setIsLoading(false);
  };
  
  const handlePlayError = (errorEvent: Error) => {
    console.error("H5AudioPlayer onPlayError callback:", errorEvent);
    setError(`Failed to play: ${errorEvent.message}`);
    setIsPlaying(false);
    setIsLoading(false);
  };

  const handlePlayPause = () => {
    if (playerRef.current?.audio.current) {
      const audio = playerRef.current.audio.current;
      if (isPlaying) {
        audio.pause();
      } else {
        audio.play().catch(e => {
            console.error("Error calling audio.play() in handlePlayPause:", e);
            setError(`Play failed: ${e.message}`);
            setIsPlaying(false);
        });
      }
    }
  };

  const handleJumpForward = () => {
    if (playerRef.current?.audio.current) {
      const audio = playerRef.current.audio.current;
      const newTime = audio.currentTime + 10;
      audio.currentTime = Math.min(newTime, audio.duration);
    }
  };

  const handleJumpBackward = () => {
    if (playerRef.current?.audio.current) {
      const audio = playerRef.current.audio.current;
      const newTime = audio.currentTime - 10;
      audio.currentTime = Math.max(0, newTime);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center w-full max-w-2xl p-4 bg-background rounded-lg border min-h-[120px]">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
        <span className="ml-3 text-muted-foreground">Loading audio...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center w-full max-w-2xl p-4 bg-background rounded-lg border border-destructive min-h-[120px]">
        <span className="text-destructive-foreground text-sm text-center">{error}</span>
        <Button variant="outline" size="sm" onClick={() => {
             // Key change on H5AudioPlayer is primary way to reload. This button can re-trigger that if audioUrl is re-passed or state forces re-render.
             // For now, simply resetting the isLoading to true might give user feedback and allow H5AudioPlayer (if it has src already) to try again on next render cycle if state changes.
             console.log("Try Again clicked. Current audioUrl: " + audioUrl);
             setIsLoading(true); // Show loading spinner again
             setError(null);
             // Forcing a re-render by parent or changing the key externally would be more robust for "Try Again"
             // Or, could try: playerRef.current?.audio.current?.load(); if playerRef is valid.
        }} className="mt-2">
            Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl bg-card text-card-foreground p-4 rounded-lg border shadow-sm">
      <style>{`
        .custom-audio-player-styles .rhap_progress-section {
          margin-bottom: 0.5rem;
        }
        .custom-audio-player-styles .rhap_progress-bar,
        .custom-audio-player-styles .rhap_progress-bar-show-download {
          height: 8px;
          border-radius: 4px;
          background-color: hsl(var(--muted));
        }
        .custom-audio-player-styles .rhap_progress-filled {
          background-color: hsl(var(--primary));
          border-radius: 4px;
        }
        .custom-audio-player-styles .rhap_download-progress {
            background-color: hsl(var(--accent));
            border-radius: 4px;
            opacity: 0.5;
        }
        .custom-audio-player-styles .rhap_progress-indicator {
          background: hsl(var(--primary-foreground));
          border: 2px solid hsl(var(--primary));
          box-shadow: 0 0 2px 1px hsla(var(--primary), 0.5);
          width: 16px;
          height: 16px;
          top: -4px;
        }
        .custom-audio-player-styles .rhap_controls-section .rhap_main-controls,
        .custom-audio-player-styles .rhap_additional-controls,
        .custom-audio-player-styles .rhap_volume-controls {
            display: none !important;
        }
      `}</style>
      <H5AudioPlayer
        key={audioUrl} // Force re-mount when audioUrl changes
        ref={playerRef}
        src={audioUrl}
        autoPlayAfterSrcChange={false}
        onLoadedMetaData={handleLoadedMetadata}
        onCanPlay={handleCanPlay}
        onError={handleError}
        onPlayError={handlePlayError}
        onPlay={() => { console.log("H5AudioPlayer onPlay event"); setIsPlaying(true); setError(null);}}
        onPause={() => { console.log("H5AudioPlayer onPause event"); setIsPlaying(false);}}
        onEnded={() => { console.log("H5AudioPlayer onEnded event"); setIsPlaying(false);}} 
        layout="stacked-reverse" 
        customProgressBarSection={[RHAP_UI.PROGRESS_BAR]}
        customControlsSection={[]} 
        showSkipControls={false}
        showJumpControls={false} 
        showDownloadProgress={true}
        showFilledProgress={true}
        className="custom-audio-player-styles" 
        // preload="auto" // This is default for H5AudioPlayer
      />
      <div className="flex justify-around items-center mt-2">
        <Button 
          variant="ghost" size="icon" onClick={handleJumpBackward} 
          className="w-12 h-12" aria-label="Jump back 10 seconds"
          disabled={isLoading || !!error}
        >
          <ReloadIcon className="w-6 h-6" /> 
        </Button>
        <Button 
          variant="ghost" size="icon" onClick={handlePlayPause} 
          className="w-12 h-12 mx-2" aria-label={isPlaying ? "Pause" : "Play"}
          disabled={isLoading || !!error}
        >
          {isPlaying ? <PauseIcon className="w-7 h-7" /> : <PlayIcon className="w-7 h-7" />}
        </Button>
        <Button 
          variant="ghost" size="icon" onClick={handleJumpForward} 
          className="w-12 h-12" aria-label="Jump forward 10 seconds"
          disabled={isLoading || !!error}
        >
          <TrackNextIcon className="w-6 h-6" /> 
        </Button>
      </div>
    </div>
  );
};

export default CustomAudioPlayer;
