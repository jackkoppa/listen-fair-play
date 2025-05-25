import { PlayIcon } from "@radix-ui/react-icons";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "./ui/sheet";
import { ApiSearchResultHit, EpisodeInManifest } from "@listen-fair-play/types";
import { Badge } from "./ui/badge";

import { formatDate } from '@/utils/date';
import { formatMillisecondsToMMSS } from '@/utils/time';

export default function EpisodeDetailsSheet({ episodeData, originalSearchResult }: { 
    episodeData: EpisodeInManifest;
    originalSearchResult: ApiSearchResultHit;
}) {
    const { title, summary, publishedAt, originalAudioURL } = episodeData;

    const formattedPublishedAt = publishedAt ? formatDate(publishedAt) : null;

    const formattedStartTime = formatMillisecondsToMMSS(originalSearchResult.startTimeMs);
    const formattedEndTime = formatMillisecondsToMMSS(originalSearchResult.endTimeMs);
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
                    <SheetHeader>
                        <SheetTitle className="text-lg/6 font-semibold mt-8 mb-2">
                            {title}
                        </SheetTitle>
                        <SheetDescription>
                            <Badge variant="destructive" className="mb-2">{formattedPublishedAt}</Badge>
                            <br/>
                            <em>{summary}</em>
                        </SheetDescription>
                        <div className="mt-4">
                            <div>
                                {/* TODO: Disable + add a loading state, until audio is ready */}
                                <audio controls src={audioUrlToLoad}></audio>
                            </div>
                            <Badge variant="outline" className="mb-2 mt-6"><em>{formattedStartTime} - {formattedEndTime}</em></Badge>
                            <div
                                className="result-highlighted-text text-sm mb-8"
                                dangerouslySetInnerHTML={{ __html: originalSearchResult.highlight || originalSearchResult.text }}
                            />
                        </div>
                    </SheetHeader>
                </SheetContent>
            </Sheet>
        </>
    );
}