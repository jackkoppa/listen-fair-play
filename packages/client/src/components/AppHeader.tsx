interface AppHeaderProps {
  scrolled: boolean;
}

export default function AppHeader({ scrolled }: AppHeaderProps) {
  return (
    <header className={`fixed top-0 left-0 right-0 z-10 bg-secondary border-b-2 border-black shadow-[0px_4px_0px_rgba(0,0,0,1)] transition-all duration-300 ease-in-out z-20 ${scrolled ? 'py-2' : 'py-4'}`}>
      <div className="max-w-3xl mx-auto px-6 text-right">
        <h1 className={`font-bold text-black transition-all duration-200 ${scrolled ? 'text-2xl mb-0' : 'text-3xl mb-1'}`}>Listen, Fair Play</h1>
        <p className={`text-sm text-black italic transition-all duration-200 ${scrolled ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100'}`}>search the Football Clichés record books</p>
      </div>
    </header>
  );
} 