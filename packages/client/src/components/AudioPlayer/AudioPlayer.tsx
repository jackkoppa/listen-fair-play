import { useState, useRef } from 'react';
import AudioPlayerH5, { RHAP_UI } from 'react-h5-audio-player';
import { PlayIcon, PauseIcon } from '@radix-ui/react-icons';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';

// Custom play/pause button component
const PlayButton = (<Button
  variant="default"
  size="icon"
  className='absolute top-0 left-0'
>
  <PlayIcon />
</Button>)

const PauseButton = (<Button
  variant="destructive"
  size="icon"
  className='absolute top-0 left-0'
>
  <PauseIcon />
</Button>)

// Custom hook for audio player state management
export const useAudioPlayer = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const playerRef = useRef<AudioPlayerH5>(null);

  const play = () => {
    if (playerRef.current?.audio?.current) {
      playerRef.current.audio.current.play();
    }
  };

  const pause = () => {
    if (playerRef.current?.audio?.current) {
      playerRef.current.audio.current.pause();
    }
  };

  const seekTo = (time: number) => {
    if (playerRef.current?.audio?.current) {
      playerRef.current.audio.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const setPlayerVolume = (vol: number) => {
    if (playerRef.current?.audio?.current) {
      playerRef.current.audio.current.volume = vol;
      setVolume(vol);
    }
  };

  const toggleMute = () => {
    if (playerRef.current?.audio?.current) {
      playerRef.current.audio.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  return {
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    isLoading,
    playerRef,
    play,
    pause,
    seekTo,
    setVolume: setPlayerVolume,
    toggleMute,
    setIsPlaying,
    setCurrentTime,
    setDuration,
    setIsLoading
  };
};

interface AudioPlayerProps {
  src: string;
  className?: string;
  autoPlay?: boolean;
  showJumpControls?: boolean;
  showDownloadProgress?: boolean;
  showFilledProgress?: boolean;
  showSkipControls?: boolean;
  showFilledVolume?: boolean;
  showVolumeControls?: boolean;
  hasDefaultKeyBindings?: boolean;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  loop?: boolean;
  muted?: boolean;
  volume?: number;
  preload?: 'auto' | 'metadata' | 'none';
  onClickNext?: () => void;
  onClickPrevious?: () => void;
  onPlay?: (e: Event) => void;
  onPause?: (e: Event) => void;
  onEnded?: (e: Event) => void;
  onLoadStart?: (e: Event) => void;
  onCanPlay?: (e: Event) => void;
  onTimeUpdate?: (e: Event) => void;
  onVolumeChange?: (e: Event) => void;
  onError?: (e: Event) => void;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({
  src,
  className,
  autoPlay = false,
  showJumpControls = true,
  showDownloadProgress = true,
  showFilledProgress = true,
  showSkipControls = false,
  showFilledVolume = true,
  hasDefaultKeyBindings = true,
  header,
  footer,
  loop = false,
  muted = false,
  volume = 1,
  preload = 'metadata',
  onClickNext,
  onClickPrevious,
  onPlay,
  onPause,
  onEnded,
  onLoadStart,
  onCanPlay,
  onTimeUpdate,
  onVolumeChange,
  onError
}) => {
  const {
    isLoading,
    playerRef,
    setIsPlaying,
    setCurrentTime,
    setDuration,
    setIsLoading
  } = useAudioPlayer();

  // Handle audio events
  const handlePlay = (e: Event) => {
    setIsPlaying(true);
    onPlay?.(e);
  };

  const handlePause = (e: Event) => {
    setIsPlaying(false);
    onPause?.(e);
  };

  const handleTimeUpdate = (e: Event) => {
    const audio = e.target as HTMLAudioElement;
    setCurrentTime(audio.currentTime);
    onTimeUpdate?.(e);
  };

  const handleLoadedMetadata = (e: Event) => {
    const audio = e.target as HTMLAudioElement;
    setDuration(audio.duration);
  };

  const handleLoadStart = (e: Event) => {
    setIsLoading(true);
    onLoadStart?.(e);
  };

  const handleCanPlay = (e: Event) => {
    setIsLoading(false);
    onCanPlay?.(e);
  };

  const handleEnded = (e: Event) => {
    setIsPlaying(false);
    onEnded?.(e);
  };

  const handleError = (e: Event) => {
    setIsLoading(false);
    setIsPlaying(false);
    onError?.(e);
  };

  return (
    <div className={cn('w-full', className)}>
      {header && <div className="mb-4">{header}</div>}

      <AudioPlayerH5
        ref={playerRef}
        src={src}
        autoPlay={autoPlay}
        showJumpControls={showJumpControls}
        showDownloadProgress={showDownloadProgress}
        showFilledProgress={showFilledProgress}
        showSkipControls={showSkipControls}
        showFilledVolume={showFilledVolume}
        onClickNext={onClickNext}
        onClickPrevious={onClickPrevious}
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={handleEnded}
        onLoadStart={handleLoadStart}
        onCanPlay={handleCanPlay}
        onListen={handleTimeUpdate}
        onLoadedMetaData={handleLoadedMetadata}
        onVolumeChange={onVolumeChange}
        onError={handleError}
        customVolumeControls={[]}
        customAdditionalControls={[]}
        hasDefaultKeyBindings={hasDefaultKeyBindings}
        customIcons={{
          play: PlayButton,
          pause: PauseButton,
        }}
        loop={loop}
        muted={muted}
        volume={volume}
        preload={preload}
        layout='stacked'
        customControlsSection={[RHAP_UI.CURRENT_TIME, RHAP_UI.MAIN_CONTROLS, RHAP_UI.CURRENT_LEFT_TIME]}
        customProgressBarSection={[RHAP_UI.PROGRESS_BAR]}
        className={cn(
          'rhap_container',
          // Custom styling to match the design system
          // '[&_.rhap_container]:bg-background [&_.rhap_container]:border [&_.rhap_container]:border-border [&_.rhap_container]:rounded-md [&_.rhap_container]:p-4',
          // '[&_.rhap_main-controls-button]:text-foreground [&_.rhap_main-controls-button]:hover:text-primary',
          // '[&_.rhap_progress-filled]:bg-primary',
          // '[&_.rhap_progress-indicator]:bg-primary [&_.rhap_progress-indicator]:border-primary',
          // '[&_.rhap_volume-filled]:bg-primary',
          // '[&_.rhap_volume-indicator]:bg-primary [&_.rhap_volume-indicator]:border-primary',
          // '[&_.rhap_main-controls]:gap-2',
          isLoading && 'opacity-75'
        )}
      />

      {footer && <div className="mt-4">{footer}</div>}
    </div>
  );
};

export default AudioPlayer; 