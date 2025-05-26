import { MagnifyingGlassIcon } from '@radix-ui/react-icons'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  isLoading: boolean
  placeholder?: string
}

export default function SearchInput({ 
  value, 
  onChange, 
  isLoading, 
  placeholder = "Search transcripts (min. 2 characters)..." 
}: SearchInputProps) {
  return (
    <div className="search-input-container mb-8 relative flex items-center">
      <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-500" />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="search-input w-full p-3 pl-10 border-black border-2 text-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 shadow-[4px_4px_0px_rgba(0,0,0,1)] rounded-none"
      />
      {isLoading && (
        <div className="search-spinner absolute right-3 top-1/2 transform -translate-y-1/2 border-t-transparent border-solid animate-spin rounded-full border-blue-500 border-4 h-6 w-6"></div>
      )}
    </div>
  )
} 