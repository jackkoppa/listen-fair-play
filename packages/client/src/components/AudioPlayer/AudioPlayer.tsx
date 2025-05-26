import { useState, useRef } from 'react';
import AudioPlayerH5, { RHAP_UI } from 'react-h5-audio-player';
import { PlayIcon, PauseIcon } from '@radix-ui/react-icons';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';

// Custom play/pause button components
const PlayButton = (
  <Button
    variant="default"
    size="icon"
    className='absolute top-0 left-0'
  >
    <PlayIcon />
  </Button>
);

const PauseButton = (
  <Button
    variant="destructive"
    size="icon"
    className='absolute top-0 left-0'
  >
    <PauseIcon />
  </Button>
);

interface AudioPlayerProps {
  src: string;
  className?: string;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({
  src,
  className
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const playerRef = useRef<AudioPlayerH5>(null);

  const handleLoadStart = () => {
    setIsLoading(true);
  };

  const handleCanPlay = () => {
    setIsLoading(false);
  };

  const handleError = () => {
    setIsLoading(false);
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
        customVolumeControls={[]}
        customAdditionalControls={[]}
        customIcons={{
          play: PlayButton,
          pause: PauseButton,
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
};

export default AudioPlayer; 