# AudioPlayer Component

A modern, customizable audio player component built on top of `react-h5-audio-player` with full integration to the Listen Fair Play design system.

## Features

- 🎵 Modern, accessible audio controls
- 🎨 Full design system integration with dark/light mode support
- 🔧 Flexible API with customizable controls
- ⌨️ Keyboard shortcuts support
- 📱 Responsive design
- 🪝 Powerful React hooks for custom implementations
- 🚀 TypeScript support

## Installation

The AudioPlayer component is already installed and configured in this project. It uses:

- `react-h5-audio-player` - The underlying audio player
- Design system components from `./ui/`
- Radix UI icons

## Basic Usage

```tsx
import AudioPlayer from '@/components/AudioPlayer';

function MyComponent() {
  return (
    <AudioPlayer
      src="https://example.com/audio.mp3"
      showJumpControls={true}
      showFilledProgress={true}
      preload="metadata"
    />
  );
}
```

## Props API

### AudioPlayerProps

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `src` | `string` | **Required** | URL of the audio file |
| `className` | `string` | `undefined` | Additional CSS classes |
| `autoPlay` | `boolean` | `false` | Auto-play audio when loaded |
| `showJumpControls` | `boolean` | `true` | Show forward/backward skip buttons |
| `showDownloadProgress` | `boolean` | `true` | Show download progress bar |
| `showFilledProgress` | `boolean` | `true` | Show filled progress bar |
| `showSkipControls` | `boolean` | `false` | Show next/previous track buttons |
| `showFilledVolume` | `boolean` | `true` | Show filled volume bar |
| `hasDefaultKeyBindings` | `boolean` | `true` | Enable keyboard shortcuts |
| `header` | `React.ReactNode` | `undefined` | Custom content above player |
| `footer` | `React.ReactNode` | `undefined` | Custom content below player |
| `loop` | `boolean` | `false` | Loop the audio |
| `muted` | `boolean` | `false` | Start muted |
| `volume` | `number` | `1` | Initial volume (0-1) |
| `preload` | `'auto' \| 'metadata' \| 'none'` | `'metadata'` | Preload strategy |

### Event Handlers

| Prop | Type | Description |
|------|------|-------------|
| `onPlay` | `(e: Event) => void` | Called when audio starts playing |
| `onPause` | `(e: Event) => void` | Called when audio is paused |
| `onEnded` | `(e: Event) => void` | Called when audio playback ends |
| `onLoadStart` | `(e: Event) => void` | Called when audio starts loading |
| `onCanPlay` | `(e: Event) => void` | Called when audio can start playing |
| `onTimeUpdate` | `(e: Event) => void` | Called during playback (time updates) |
| `onVolumeChange` | `(e: Event) => void` | Called when volume changes |
| `onError` | `(e: Event) => void` | Called when an error occurs |
| `onClickNext` | `() => void` | Called when next button is clicked |
| `onClickPrevious` | `() => void` | Called when previous button is clicked |

## Advanced Usage

### With Custom Header and Footer

```tsx
import AudioPlayer from '@/components/AudioPlayer';
import { Badge } from '@/components/ui/badge';

function MyComponent() {
  return (
    <AudioPlayer
      src="https://example.com/podcast.mp3"
      header={
        <div className="text-center">
          <h3 className="font-semibold">Episode Title</h3>
          <p className="text-sm text-muted-foreground">Podcast Name</p>
        </div>
      }
      footer={
        <div className="flex justify-between">
          <Badge variant="secondary">Technology</Badge>
          <span className="text-xs text-muted-foreground">45 min</span>
        </div>
      }
    />
  );
}
```

### Using the Hook for Custom Controls

```tsx
import { useAudioPlayer, PlayPauseButton, MuteButton } from '@/components/AudioPlayer';
import { Button } from '@/components/ui/button';

function CustomAudioPlayer() {
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

  return (
    <div className="space-y-4">
      {/* Hidden actual player */}
      <div className="hidden">
        <AudioPlayer
          src="https://example.com/audio.mp3"
          showJumpControls={false}
          showDownloadProgress={false}
          showFilledProgress={false}
          showSkipControls={false}
          showFilledVolume={false}
        />
      </div>

      {/* Custom controls */}
      <div className="flex items-center gap-2">
        <Button onClick={() => seekTo(currentTime - 10)}>-10s</Button>
        
        <PlayPauseButton
          isPlaying={isPlaying}
          onClick={isPlaying ? pause : play}
          disabled={isLoading}
        />
        
        <Button onClick={() => seekTo(currentTime + 10)}>+10s</Button>
        
        <MuteButton
          isMuted={isMuted}
          onClick={toggleMute}
        />
      </div>

      {/* Custom volume control */}
      <input
        type="range"
        min="0"
        max="1"
        step="0.1"
        value={volume}
        onChange={(e) => setVolume(parseFloat(e.target.value))}
      />
    </div>
  );
}
```

## Hook API

### useAudioPlayer()

Returns an object with the following properties and methods:

#### State

| Property | Type | Description |
|----------|------|-------------|
| `isPlaying` | `boolean` | Whether audio is currently playing |
| `currentTime` | `number` | Current playback time in seconds |
| `duration` | `number` | Total audio duration in seconds |
| `volume` | `number` | Current volume (0-1) |
| `isMuted` | `boolean` | Whether audio is muted |
| `isLoading` | `boolean` | Whether audio is loading |
| `playerRef` | `RefObject<AudioPlayerH5>` | Ref to the audio player instance |

#### Methods

| Method | Type | Description |
|--------|------|-------------|
| `play` | `() => void` | Start playback |
| `pause` | `() => void` | Pause playback |
| `seekTo` | `(time: number) => void` | Seek to specific time |
| `setVolume` | `(volume: number) => void` | Set volume (0-1) |
| `toggleMute` | `() => void` | Toggle mute state |

#### Internal State Setters

| Method | Type | Description |
|--------|------|-------------|
| `setIsPlaying` | `(playing: boolean) => void` | Update playing state |
| `setCurrentTime` | `(time: number) => void` | Update current time |
| `setDuration` | `(duration: number) => void` | Update duration |
| `setIsLoading` | `(loading: boolean) => void` | Update loading state |

## Standalone Components

### PlayPauseButton

A styled play/pause toggle button.

```tsx
import { PlayPauseButton } from '@/components/AudioPlayer';

<PlayPauseButton
  isPlaying={isPlaying}
  onClick={togglePlayPause}
  size="lg"
  variant="outline"
  disabled={isLoading}
/>
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `isPlaying` | `boolean` | **Required** | Current playing state |
| `onClick` | `() => void` | **Required** | Click handler |
| `disabled` | `boolean` | `false` | Disable the button |
| `size` | `'sm' \| 'default' \| 'lg'` | `'default'` | Button size |
| `variant` | `'default' \| 'outline' \| 'secondary' \| 'ghost'` | `'default'` | Button variant |

### MuteButton

A styled mute toggle button.

```tsx
import { MuteButton } from '@/components/AudioPlayer';

<MuteButton
  isMuted={isMuted}
  onClick={toggleMute}
  variant="ghost"
/>
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `isMuted` | `boolean` | **Required** | Current muted state |
| `onClick` | `() => void` | **Required** | Click handler |
| `disabled` | `boolean` | `false` | Disable the button |
| `size` | `'sm' \| 'default' \| 'lg'` | `'default'` | Button size |
| `variant` | `'default' \| 'outline' \| 'secondary' \| 'ghost'` | `'ghost'` | Button variant |

## Styling

The AudioPlayer automatically integrates with the design system. It respects:

- Color tokens (primary, muted, background, etc.)
- Dark/light mode theming
- Border radius settings
- Font families (mono for time displays)
- Spacing and shadows

### Custom Styling

You can customize the appearance using CSS custom properties or by overriding the classes:

```css
/* Custom progress bar color */
.rhap_progress-filled {
  background-color: #your-color !important;
}

/* Custom button hover state */
.rhap_main-controls-button:hover {
  background-color: #your-hover-color !important;
}
```

## Keyboard Shortcuts

When `hasDefaultKeyBindings` is enabled (default), the following shortcuts are available:

- **Space**: Play/Pause
- **←/→**: Skip backward/forward
- **↑/↓**: Volume up/down
- **M**: Toggle mute

## Accessibility

The AudioPlayer component includes:

- ARIA labels for all controls
- Keyboard navigation support
- Screen reader compatible time announcements
- High contrast mode support
- Focus indicators

## Examples

See `AudioPlayerExample.tsx` for complete working examples including:

1. Basic usage
2. Custom header/footer layout
3. Custom controls with hooks
4. Integration patterns

## Browser Support

The component supports all modern browsers that support:

- HTML5 audio
- ES6+ features
- CSS custom properties

## Troubleshooting

### Audio not loading

1. Check the `src` URL is accessible
2. Verify CORS headers for cross-origin audio
3. Ensure the audio format is supported
4. Check browser developer tools for errors

### Styling issues

1. Ensure CSS import is included: `@import "react-h5-audio-player/lib/styles.css"`
2. Check if custom styles are being overridden
3. Verify design system tokens are properly configured

### Performance issues

1. Use `preload="metadata"` for better loading performance
2. Consider audio compression for large files
3. Implement lazy loading for multiple players 