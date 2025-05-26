import { PlayIcon, CaretSortIcon, MinusCircledIcon } from "@radix-ui/react-icons";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "./ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { ApiSearchResultHit, EpisodeInManifest } from "@listen-fair-play/types";
import { Badge } from "./ui/badge";
import AudioPlayer from "./AudioPlayer/AudioPlayer";

import { formatDate } from '@/utils/date';
import { formatMillisecondsToMMSS } from '@/utils/time';
import { useState } from "react";

export default function EpisodeDetailsSheet({ episodeData, originalSearchResult }: {
    episodeData: EpisodeInManifest;
    originalSearchResult: ApiSearchResultHit;
}) {
    const { title, summary, publishedAt, originalAudioURL } = episodeData;
    const [isDescriptionOpen, setIsDescriptionOpen] = useState(false);

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
                        <div className="flex flex-row gap-2">
                            <Badge variant="destructive">{formattedPublishedAt}</Badge>
                            <Popover onOpenChange={setIsDescriptionOpen}>
                                <PopoverTrigger className="relative cursor-pointer">
                                    <Badge variant="outline" className="absolute top-0 left-0">
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
                                showJumpControls={true}
                                showDownloadProgress={true}
                                showFilledProgress={true}
                                showSkipControls={false}
                                showFilledVolume={true}
                                hasDefaultKeyBindings={true}
                                preload="metadata"
                                className="mb-4"
                            />
                        </div>
                        <SheetDescription>

                        </SheetDescription>
                        <div className="mt-4">
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