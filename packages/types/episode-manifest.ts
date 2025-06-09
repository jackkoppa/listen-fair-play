export type PodcastId = 'football-cliches' | 'for-our-sins-the-cliches-pod-archive';

export interface LlmAnnotations {
    episodeType?: string;
    panelists?: string[];
    // Add other potential LLM annotation fields here as they become known
}

export interface EpisodeInManifest {
    sequentialId: number;
    podcastId: PodcastId; // e.g., "football-cliches"
    title: string;
    fileKey: string; // e.g., "2020-01-23_The-Transfer-Window" (used to construct audio file path)
    originalAudioURL: string;
    summary: string;
    durationInSeconds?: number; // Optional, as it might not always be available or consistently formatted in RSS
    publishedAt: string; // ISO 8601 date string
    hasCompletedLLMAnnotations: boolean;
    llmAnnotations: LlmAnnotations;
}

export interface EpisodeManifest {
    lastUpdated: string; // ISO 8601 date string
    episodes: EpisodeInManifest[];
} 