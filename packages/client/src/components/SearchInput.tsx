import { MagnifyingGlassIcon } from '@radix-ui/react-icons'
import { Button } from "@/components/ui/button"

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  onSearch: () => void
  isLoading: boolean
}

const PLACEHOLDER_OPTIONS = [
  "gets the shot away",
  "no disrespect to egg",
  "corridor of uncertainty",
  "football clubbing",
  "come what February"
]

// Do this outside of React component, so that we always get the same placeholder for each page load
const placeholderBase = PLACEHOLDER_OPTIONS[Math.floor(Math.random() * PLACEHOLDER_OPTIONS.length)]
const placeholder = `e.g. "${placeholderBase}"`

export default function SearchInput({ 
  value, 
  onChange, 
  onSearch,
  isLoading,
}: SearchInputProps) {
  const handleChange = (newValue: string) => {
    onChange(newValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onSearch();
    }
  };

  const handleSearchClick = () => {
    onSearch();
  };

  return (
    <div className="search-input-container mx-[-16px] pt-4 pb-8 px-[16px] sticky top-13.5 flex flex-col items-center bg-gradient-to-b from-white from-85% to-transparent z-10">
      <div className="relative w-full flex gap-2">
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className="search-input flex-1 py-2 px-4 border-black border-2 text-md focus:outline-none focus:ring-2 focus:ring-yellow-400 shadow-[4px_4px_0px_rgba(0,0,0,1)] rounded-none"
        />
        <Button
          onClick={handleSearchClick}
          disabled={isLoading || value.trim().length < 2}
          className="h-12 w-12 p-0 border-black border-2 shadow-[4px_4px_0px_rgba(0,0,0,1)] rounded-none bg-white hover:bg-gray-100 disabled:bg-gray-200 disabled:shadow-none transition-opacity duration-200 flex items-center justify-center"
        >
          {isLoading ? (
            <div className="border-t-transparent border-solid animate-spin rounded-full border-blue-500 border-2 h-5 w-5"></div>
          ) : (
            <MagnifyingGlassIcon className="text-black size-6" />
          )}
        </Button>
      </div>
    </div>
  )
} 