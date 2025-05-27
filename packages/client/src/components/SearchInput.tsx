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
    <div className="search-input-container mx-[-16px] pt-4 pb-8 px-[16px] sticky top-13 flex items-center bg-gradient-to-b from-white from-85% to-transparent z-10">
      <MagnifyingGlassIcon className="absolute left-6 top-1/2 transform -translate-y-4/5 h-7 w-6 text-gray-500" />
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