import React from 'react';
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "./ui/drawer";

interface PlayTimeLimitDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  episodeTitle: string;
}

export default function PlayTimeLimitDialog({ 
  isOpen, 
  onOpenChange, 
  episodeTitle 
}: PlayTimeLimitDialogProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const handlePodcastLinkClick = () => {
    window.open('https://podfollow.com/new-football-cliches', '_blank');
    onOpenChange(false);
  };

  const dialogContent = (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        <p className="mb-3">
          You've listened to 5 minutes of this episode. To continue listening, you can:
        </p>
        <ul className="list-disc list-inside space-y-1 mb-4">
          <li>Listen to the rest of this episode in your podcast player of choice</li>
          <li>Continue exploring and searching across other episodes on this site</li>
        </ul>
      </div>
      
      <div className="flex flex-col gap-2">
        <Button 
          onClick={handlePodcastLinkClick}
          className="w-full"
        >
          Open in Podcast App
        </Button>
        
        <Button 
          variant="outline" 
          onClick={() => onOpenChange(false)}
          className="w-full"
        >
          Continue Browsing Episodes
        </Button>
      </div>
    </div>
  );

  if (isDesktop) {
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px] font-mono bg-background text-foreground">
          <DialogHeader>
            <DialogTitle className="text-xl">5-Minute Listening Limit Reached</DialogTitle>
            <DialogDescription>
              You've reached the 5-minute listening limit for "{episodeTitle}"
            </DialogDescription>
          </DialogHeader>
          {dialogContent}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={isOpen} onOpenChange={onOpenChange}>
      <DrawerContent className="font-mono bg-background text-foreground">
        <DrawerHeader className="text-left">
          <DrawerTitle className="text-xl">5-Minute Listening Limit Reached</DrawerTitle>
          <DrawerDescription>
            You've reached the 5-minute listening limit for "{episodeTitle}"
          </DrawerDescription>
        </DrawerHeader>
        <div className="p-4">
          {dialogContent}
        </div>
        <DrawerFooter className="pt-2">
          <DrawerClose asChild>
            <Button variant="outline" size="default">Done</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
} 