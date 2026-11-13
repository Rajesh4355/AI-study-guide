export type AppView = 'create' | 'flashcards' | 'quiz' | 'saved';

interface HeaderProps {
  activeView: AppView;
  hasActiveDeck: boolean;
  savedCount: number;
  onNavigate: (view: AppView) => void;
  onNewDeck: () => void;
}

export function Header({
  activeView,
  hasActiveDeck,
  savedCount,
  onNavigate,
  onNewDeck,
}: HeaderProps) {
  const navItems: Array<{ id: AppView; label: string; disabled?: boolean }> = [
    { id: 'create', label: 'Create' },
    { id: 'flashcards', label: 'Flashcards', disabled: !hasActiveDeck },
    { id: 'quiz', label: 'Quiz', disabled: !hasActiveDeck },
    { id: 'saved', label: `Saved (${savedCount})` },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/90">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-4 py-3.5 sm:px-6">
        <button
          type="button"
          onClick={() => onNavigate('create')}
          className="font-display text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 transition-colors hover:text-sky-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:text-slate-100 dark:hover:text-sky-400"
        >
          StudyDeck
        </button>

        <nav aria-label="Primary navigation" className="hidden md:flex items-center gap-7">
          {navItems.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                disabled={item.disabled}
                onClick={() => onNavigate(item.id)}
                className={`relative py-1.5 text-sm font-medium whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-600 ${
                  item.disabled
                    ? 'cursor-not-allowed text-slate-400 dark:text-slate-600'
                    : isActive
                    ? 'text-slate-950 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-[15px] h-0.5 bg-sky-600 dark:bg-sky-400"
                  />
                )}
              </button>
            );
          })}
        </nav>

        <div className="shrink-0">
          <button
            type="button"
            onClick={onNewDeck}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white whitespace-nowrap shrink-0 shadow-xs transition-all hover:bg-sky-700 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:bg-sky-600 dark:text-white dark:hover:bg-sky-500"
          >
            New Deck
          </button>
        </div>
      </div>
    </header>
  );
}
