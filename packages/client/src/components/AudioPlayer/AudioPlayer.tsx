import { useState, useRef, useImperativeHandle, forwardRef } from 'react';
import AudioPlayerH5, { RHAP_UI } from 'react-h5-audio-player';
import { PlayIcon, PauseIcon } from '@radix-ui/react-icons';
import { cn } from '@/lib/utils';

const baseIconButtonStyle = 'flex items-center justify-center w-8 h-8 -mt-1';

// Custom play/pause icon elements (NOT buttons - the library will wrap them in buttons)
const PlayIconElement = (
  // Given that we can't use <Button> here, we'll roughly attempt to match the styling from `../ui/button.tsx`
  <div className={cn(baseIconButtonStyle, 'bg-primary text-primary-foreground shadow-xs hover:bg-primary/90')}>
    <PlayIcon className="w-4 h-4" />
  </div>
);

const PauseIconElement = (
  // Given that we can't use <Button> here, we'll roughly attempt to match the styling from `../ui/button.tsx`
  <div className={cn(baseIconButtonStyle, 'bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60')}>
    <PauseIcon className="w-4 h-4" />
  </div>
);

interface AudioPlayerProps {
  src: string;
  onListen: (currentTimeMs: number) => void;
  onPlay?: () => void;
  className?: string;
}

export interface AudioPlayerRef {
  seekTo: (timeMs: number) => void;
}

const AudioPlayer = forwardRef<AudioPlayerRef, AudioPlayerProps>(({
  src,
  className,
  onListen,
  onPlay
}, ref) => {
  const [isLoading, setIsLoading] = useState(false);
  const playerRef = useRef<AudioPlayerH5>(null);

  // Expose seekTo method to parent component
  useImperativeHandle(ref, () => ({
    seekTo: (timeMs: number) => {
      if (playerRef.current?.audio?.current) {
        playerRef.current.audio.current.currentTime = timeMs / 1000; // Convert ms to seconds
      }
    }
  }));

  const handleLoadStart = () => {
    setIsLoading(true);
  };

  const handleCanPlay = () => {
    setIsLoading(false);
  };

  const handleError = () => {
    setIsLoading(false);
  };

  const handleListen = (event: Event) => {
    const audio = event.target as HTMLAudioElement;
    const currentTimeMs = audio.currentTime * 1000; // Convert seconds to milliseconds
    onListen(currentTimeMs);
  };

  const handlePlay = () => {
    if (onPlay) {
      onPlay();
    }
  };

  return (
    <div className={cn('w-full', className)}>
      <AudioPlayerH5
        ref={playerRef}
        src={src}
        autoPlay={false}
        showJumpControls={true}
        showDownloadProgress={true}
        showFilledProgress={true}
        showSkipControls={false}
        showFilledVolume={true}
        hasDefaultKeyBindings={true}
        preload="metadata"
        onLoadStart={handleLoadStart}
        onCanPlay={handleCanPlay}
        onError={handleError}
        onPlay={handlePlay}
        onListen={handleListen}
        customVolumeControls={[]}
        customAdditionalControls={[]}
        customIcons={{
          play: PlayIconElement,
          pause: PauseIconElement,
        }}
        loop={false}
        muted={false}
        volume={1}
        layout='stacked'
        customControlsSection={[RHAP_UI.CURRENT_TIME, RHAP_UI.MAIN_CONTROLS, RHAP_UI.CURRENT_LEFT_TIME]}
        customProgressBarSection={[RHAP_UI.PROGRESS_BAR]}
        className={cn(
          'rhap_container',
          isLoading && 'opacity-75'
        )}
      />
    </div>
  );
});

AudioPlayer.displayName = 'AudioPlayer';

export default AudioPlayer; 