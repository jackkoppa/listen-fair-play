import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PlayIcon } from "@radix-ui/react-icons";

// Quote display duration constant (7 seconds as specified)
const QUOTE_DISPLAY_DURATION_MS = 7000;

interface Quote {
  id: number;
  text: string;
  episodeId: number;
  startTimeMs: number;
  searchQuery: string;
  description: string;
}

// Example quotes from the instructions
const COLD_START_QUOTES: Quote[] = [
  {
    id: 1,
    text: "I mean, The Kop holds, in its current form, it holds about 12,000 people. 12,000 sucks, you could move a Premier League issue football, a standard Premier League match ball, maybe an inch, maybe an inch and a half.",
    episodeId: 46,
    startTimeMs: 1731100,
    searchQuery: "the+kop+holds",
    description: "Football chants you don't hear any more, with Elis James"
  },
  {
    id: 2,
    text: "I would go as far to say now, Dave, that come what February should now be the official tagline for the Carabao Cup. The Carabao, come what February.",
    episodeId: 130,
    startTimeMs: 746640,
    searchQuery: "come+what+February",
    description: "\"Come what February\", Pep vs Pat and Lukaku's bangers"
  },
  {
    id: 3,
    text: "Brilliant for the football club, obviously. You know, having been at the football club 10 years ago, I've still got, you know, a soft spot for the football club.",
    episodeId: 336,
    startTimeMs: 397040,
    searchQuery: "Brilliant+for+the+football+club",
    description: "The Adjudication Panel: Mourinho in Turkey, 71 billion calories & a football club every 2.24 seconds"
  }
];

interface ColdStartLoaderProps {
  onComplete?: () => void;
}

const ColdStartLoader: React.FC<ColdStartLoaderProps> = ({ onComplete }) => {
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Rotate through quotes every QUOTE_DISPLAY_DURATION_MS
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentQuoteIndex((prevIndex) => 
        (prevIndex + 1) % COLD_START_QUOTES.length
      );
    }, QUOTE_DISPLAY_DURATION_MS);

    return () => clearInterval(interval);
  }, []);

  const currentQuote = COLD_START_QUOTES[currentQuoteIndex];

  const handleQuoteClick = () => {
    // Preserve all current search query parameters
    const currentParams = new URLSearchParams(searchParams);
    
    // Override with quote-specific parameters
    currentParams.set('q', decodeURIComponent(currentQuote.searchQuery.replace(/\+/g, ' ')));
    currentParams.set('start', currentQuote.startTimeMs.toString());

    // Navigate to episode route with all parameters
    const queryString = currentParams.toString();
    navigate(`/episode/${currentQuote.episodeId}${queryString ? `?${queryString}` : ''}`);
  };

  const handleFadeOut = () => {
    setIsVisible(false);
    setTimeout(() => {
      onComplete?.();
    }, 300); // Wait for fade out animation
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="cold-start-loader animate-in fade-in duration-300">
      {/* Helper text */}
      <div className="text-center mb-6">
        <p className="text-sm text-gray-600 font-mono">
          Starting up search... enjoy some Clichés favorites in the meantime
        </p>
      </div>

      {/* Quote card */}
      <Card className="mb-4 border-black border-2 shadow-[4px_4px_0px_rgba(0,0,0,1)] rounded-none gap-2 transition-all duration-300 hover:shadow-[6px_6px_0px_rgba(0,0,0,1)] cursor-pointer"
            onClick={handleQuoteClick}>
        <CardContent className="pt-6">
          <p className="text-base font-mono leading-relaxed text-gray-800">
            "{currentQuote.text}"
          </p>
        </CardContent>
        <CardFooter className="block">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <Badge variant="outline" className="mb-2">
                Episode {currentQuote.episodeId}
              </Badge>
              <p className="text-xs text-gray-600 italic">
                {currentQuote.description}
              </p>
            </div>
            <Button variant="outline" size="sm">
              <PlayIcon className="w-3 h-3 mr-1" />
              Listen
            </Button>
          </div>
        </CardFooter>
      </Card>

      {/* Quote indicators */}
      <div className="flex justify-center space-x-2 mb-4">
        {COLD_START_QUOTES.map((_, index) => (
          <div
            key={index}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              index === currentQuoteIndex 
                ? 'bg-black' 
                : 'bg-gray-300'
            }`}
          />
        ))}
      </div>

      {/* Skip button */}
      <div className="text-center">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleFadeOut}
          className="text-gray-500 hover:text-gray-700"
        >
          Skip loading screen
        </Button>
      </div>
    </div>
  );
};

export default ColdStartLoader; 