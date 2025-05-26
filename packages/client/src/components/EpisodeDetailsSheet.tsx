import { PlayIcon, CaretSortIcon, MinusCircledIcon } from "@radix-ui/react-icons";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "./ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { ApiSearchResultHit, EpisodeInManifest, SearchEntry } from "@listen-fair-play/types";
import { Badge } from "./ui/badge";
import AudioPlayer from "./AudioPlayer/AudioPlayer";

import { formatDate } from '@/utils/date';
import { formatMillisecondsToMMSS } from '@/utils/time';
import { useEffect, useState, useRef } from "react";
import { S3_HOSTED_FILES_BASE_URL } from "@/constants";

async function getFullEpisodeSearchEntryFile(fileKey: string, podcastId: string): Promise<SearchEntry[]> {
    const response = await fetch(`${S3_HOSTED_FILES_BASE_URL}search-entries/${podcastId}/${fileKey}.json`);
    const data = await response.json();
    return data;
}

function FullEpisodeTranscript({ episodeData, originalSearchResult }: {
    episodeData: EpisodeInManifest;
    originalSearchResult: ApiSearchResultHit;
}) {
    const [searchEntries, setSearchEntries] = useState<SearchEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const selectedEntryRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        getFullEpisodeSearchEntryFile(episodeData.fileKey, episodeData.podcastId).then(setSearchEntries);
        setIsLoading(false);
    }, [episodeData]);

    useEffect(() => {
        if (!isLoading && searchEntries.length > 0 && selectedEntryRef.current) {
            selectedEntryRef.current.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }
    }, [isLoading, searchEntries]);

    function isCurrentlySelected(entry: SearchEntry) {
        return originalSearchResult.id === entry.id;
    }

    return (
    <div>
        {isLoading && null}
        {!isLoading && searchEntries.length === 0 && <p>Episode transcript not available. Please try refreshing the page.</p>}
        {!isLoading && searchEntries.length > 0 && (
            <div>

                {searchEntries.map((entry) => (
                    <div 
                        key={entry.id} 
                        ref={isCurrentlySelected(entry) ? selectedEntryRef : null}
                        className={'py-2 px-4' + (isCurrentlySelected(entry) ? ' bg-yellow-100 font-bold' : ' text-muted-foreground')}
                    >
                        <Badge variant="outline" className="my-1"><em>{formatMillisecondsToMMSS(entry.startTimeMs)} - {formatMillisecondsToMMSS(entry.endTimeMs)}</em></Badge>
                        <p>{entry.text}</p>
                    </div>
                ))  }
            </div>
        )}
    </div>

    );
}


export default function EpisodeDetailsSheet({ episodeData, originalSearchResult }: {
    episodeData: EpisodeInManifest;
    originalSearchResult: ApiSearchResultHit;
}) {
    const { title, summary, publishedAt, originalAudioURL } = episodeData;
    const [isDescriptionOpen, setIsDescriptionOpen] = useState(false);

    const formattedPublishedAt = publishedAt ? formatDate(publishedAt) : null;

    const formattedStartTime = formatMillisecondsToMMSS(originalSearchResult.startTimeMs);
    const audioUrlToLoad = `${originalAudioURL}#t=${formattedStartTime}`;


    return (
        <>
            <Sheet >
                <SheetTrigger asChild>
                    <Button>
                        <PlayIcon />
                        Load Here
                    </Button>
                </SheetTrigger>
                <SheetContent className="font-mono overflow-y-auto w-[350px]">
                    <SheetHeader className="sticky top-0 bg-gradient-to-b from-white from-85% to-transparent pb-4">
                        <div className="flex flex-row gap-2">
                            <Badge variant="destructive">{formattedPublishedAt}</Badge>
                            <Popover onOpenChange={setIsDescriptionOpen}>
                                <PopoverTrigger className="relative cursor-pointer">
                                    <Badge variant="outline" className="absolute top-0 left-0 hover:bg-accent hover:text-accent-foreground">
                                        Summary
                                        {isDescriptionOpen ? <MinusCircledIcon /> : <CaretSortIcon />}
                                    </Badge>
                                </PopoverTrigger>
                                <PopoverContent align="center" side="bottom" className="text-sm"><em>{summary}</em></PopoverContent>
                            </Popover>
                        </div>
                        <SheetTitle className="text-lg/6 font-semibold mt-2 mb-2">
                            {title}
                        </SheetTitle>
                        <div>
                            <AudioPlayer
                                src={audioUrlToLoad}
                                className="mb-4"
                            />
                        </div>
                        <SheetDescription>

                        </SheetDescription>
                    </SheetHeader>
                    <FullEpisodeTranscript episodeData={episodeData} originalSearchResult={originalSearchResult} />
                </SheetContent>
            </Sheet>
        </>
    );
}