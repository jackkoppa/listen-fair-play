import { useState } from 'react';
import AudioPlayer, { PlayPauseButton, MuteButton, useAudioPlayer } from './AudioPlayer/AudioPlayer';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

// Example 1: Basic AudioPlayer usage
export const BasicAudioPlayerExample = () => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Basic Audio Player</h3>
      <AudioPlayer
        src="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
        showJumpControls={true}
        showDownloadProgress={true}
        showFilledProgress={true}
        preload="metadata"
      />
    </div>
  );
};

// Example 2: AudioPlayer with custom header and footer
export const CustomLayoutExample = () => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Audio Player with Custom Layout</h3>
      <AudioPlayer
        src="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3"
        header={
          <div className="text-center">
            <h4 className="font-semibold">SoundHelix Song #2</h4>
            <p className="text-sm text-muted-foreground">A beautiful ambient track</p>
          </div>
        }
        footer={
          <div className="flex justify-between items-center">
            <Badge variant="secondary">Ambient</Badge>
            <span className="text-xs text-muted-foreground">Free to use</span>
          </div>
        }
        showJumpControls={true}
        showFilledProgress={true}
      />
    </div>
  );
};

// Example 3: Using the useAudioPlayer hook with custom controls
export const CustomControlsExample = () => {
  const {
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    isLoading,
    play,
    pause,
    seekTo,
    setVolume,
    toggleMute
  } = useAudioPlayer();

  const [customSrc] = useState("https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3");

  const handleSeekForward = () => {
    seekTo(Math.min(currentTime + 10, duration));
  };

  const handleSeekBackward = () => {
    seekTo(Math.max(currentTime - 10, 0));
  };

  const formatTime = (timeInSeconds: number): string => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Custom Controls with Hook</h3>
      
      {/* Hidden audio player for functionality */}
      <div className="hidden">
        <AudioPlayer
          src={customSrc}
          showJumpControls={false}
          showDownloadProgress={false}
          showFilledProgress={false}
          showSkipControls={false}
          showFilledVolume={false}
        />
      </div>

      {/* Custom UI */}
      <div className="border rounded-lg p-4 space-y-4">
        <div className="text-center">
          <h4 className="font-semibold">SoundHelix Song #3</h4>
          <p className="text-sm text-muted-foreground">
            Custom controls demonstration
          </p>
        </div>

        {/* Custom controls */}
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSeekBackward}
            disabled={isLoading}
          >
            -10s
          </Button>
          
          <PlayPauseButton
            isPlaying={isPlaying}
            onClick={isPlaying ? pause : play}
            disabled={isLoading}
            size="lg"
          />
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleSeekForward}
            disabled={isLoading}
          >
            +10s
          </Button>
          
          <MuteButton
            isMuted={isMuted}
            onClick={toggleMute}
            disabled={isLoading}
          />
        </div>

        {/* Progress display */}
        <div className="text-center space-y-1">
          <div className="text-sm font-mono">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
          <div className="text-xs text-muted-foreground">
            Volume: {Math.round(volume * 100)}%
          </div>
        </div>

        {/* Volume control */}
        <div className="flex items-center gap-2">
          <span className="text-sm">Volume:</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="flex-1"
            disabled={isLoading}
          />
        </div>

        {/* Status */}
        <div className="text-center">
          <Badge variant={isLoading ? "secondary" : isPlaying ? "default" : "outline"}>
            {isLoading ? "Loading..." : isPlaying ? "Playing" : "Paused"}
          </Badge>
        </div>
      </div>
    </div>
  );
};

// Main example component showcasing all patterns
const AudioPlayerExample = () => {
  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold">AudioPlayer Component Examples</h1>
        <p className="text-muted-foreground">
          Different ways to use the AudioPlayer component in your application
        </p>
      </div>

      <BasicAudioPlayerExample />
      <CustomLayoutExample />
      <CustomControlsExample />
    </div>
  );
};

export default AudioPlayerExample; 