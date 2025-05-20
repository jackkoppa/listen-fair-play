import React, { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  SheetClose
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button"; // Assuming button component will be added or is available

function App() {
  const [isAboutSheetOpen, setIsAboutSheetOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center p-4 md:p-8">
      {/* Header / Title */}
      <header className="w-full max-w-3xl mb-8 text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-800">Listen, Fair Play</h1>
        <p className="text-lg text-gray-600 mt-2">The Football Clichés Podcast Archive</p>
      </header>

      {/* Search Bar and Filters Area */}
      <main className="w-full max-w-3xl bg-white p-6 md:p-8 shadow-lg rounded-md border-2 border-black">
        {/* Search Input */}
        <div className="mb-6">
          <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">Search episodes</label>
          <input 
            type="text" 
            name="search" 
            id="search" 
            className="w-full p-3 border-2 border-black rounded-md focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 outline-none"
            placeholder="e.g., 'late drama', 'metatarsal', 'bumper day'"
          />
        </div>

        {/* Filters and Sorting Placeholder */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label htmlFor="filter-panelists" className="block text-sm font-medium text-gray-700 mb-1">Panelists</label>
            <select 
              id="filter-panelists" 
              name="filter-panelists" 
              className="w-full p-3 border-2 border-black rounded-md bg-white focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 outline-none"
            >
              <option>All Panelists</option>
              {/* TODO: Add panelist options */}
            </select>
          </div>
          <div>
            <label htmlFor="filter-episode-type" className="block text-sm font-medium text-gray-700 mb-1">Episode Type</label>
            <select 
              id="filter-episode-type" 
              name="filter-episode-type" 
              className="w-full p-3 border-2 border-black rounded-md bg-white focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 outline-none"
            >
              <option>All Types</option>
              {/* TODO: Add episode type options */}
            </select>
          </div>
          <div>
            <label htmlFor="sort-by" className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
            <select 
              id="sort-by" 
              name="sort-by" 
              className="w-full p-3 border-2 border-black rounded-md bg-white focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 outline-none"
            >
              <option value="relevance">Relevance</option>
              <option value="date">Date</option>
            </select>
          </div>
        </div>
        
        {/* Search Button (optional, search could be on type) */}
        {/* <button 
            className="w-full p-3 bg-yellow-400 text-black font-bold rounded-md border-2 border-black hover:bg-yellow-500 focus:ring-2 focus:ring-yellow-300 outline-none"
        >
          Search
        </button> */}
      </main>

      {/* Footer with About Link */}
      <footer className="w-full max-w-3xl mt-8 text-center">
        <Sheet open={isAboutSheetOpen} onOpenChange={setIsAboutSheetOpen}>
          <SheetTrigger asChild>
            <button className="text-sm text-gray-600 hover:text-gray-800 hover:underline">
              About Listen, Fair Play
            </button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>About Listen, Fair Play (LFP)</SheetTitle>
              <SheetDescription>
                LFP is an application for searching the archives of the Football Clichés podcast. 
                Find your favorite moments, panelists, and classic footballing phrases.
              </SheetDescription>
            </SheetHeader>
            <div className="py-4">
              <p>This project is open source. You can find the repository <a href="https://github.com/jackkoppa/listen-fair-play" target="_blank" rel="noopener noreferrer" className="underline text-blue-600 hover:text-blue-800">here</a>.</p>
            </div>
            <SheetFooter>
              <SheetClose asChild>
                <Button type="button" variant="outline">Close</Button>
              </SheetClose>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </footer>
    </div>
  );
}

export default App;
