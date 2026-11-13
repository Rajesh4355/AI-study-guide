import { useState } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';

interface DeckRefineBarProps {
  isRefining: boolean;
  refineError: string | null;
  onRefine: (instruction: string) => Promise<boolean>;
  onClearError: () => void;
}

const QUICK_REFINEMENTS = [
  'Add 2 more flashcards on key edge cases',
  'Make quiz questions more application-based',
  'Simplify explanations for clarity',
];

export function DeckRefineBar({
  isRefining,
  refineError,
  onRefine,
  onClearError,
}: DeckRefineBarProps) {
  const [instruction, setInstruction] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = instruction.trim();
    if (trimmed.length < 3 || isRefining) return;
    const succeeded = await onRefine(trimmed);
    if (succeeded) {
      setInstruction('');
    }
  };

  return (
    <section
      aria-label="Refine current study deck"
      className="mx-auto mt-10 max-w-3xl rounded-2xl border border-slate-200/90 bg-white/80 p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900/80"
    >
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
          Refine this deck
        </h2>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Edit the active deck in place while keeping your study progress
        </span>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
        <label htmlFor="refine-deck-input" className="sr-only">
          Refinement instruction
        </label>
        <input
          id="refine-deck-input"
          type="text"
          value={instruction}
          disabled={isRefining}
          onChange={(e) => {
            if (refineError) onClearError();
            setInstruction(e.target.value);
          }}
          placeholder="e.g., Add 2 harder quiz questions or clarify the ATP yield cards..."
          className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-sky-600 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-600/10 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-sky-400"
        />
        <button
          type="submit"
          disabled={instruction.trim().length < 3 || isRefining}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white whitespace-nowrap shrink-0 transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-sky-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
        >
          <RotateCw
            className={`h-4 w-4 ${isRefining ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
          {isRefining ? 'Updating...' : 'Update Deck'}
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {QUICK_REFINEMENTS.map((preset) => (
          <button
            key={preset}
            type="button"
            disabled={isRefining}
            onClick={() => setInstruction(preset)}
            className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 whitespace-nowrap transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 dark:border-slate-800 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            {preset}
          </button>
        ))}
      </div>

      {refineError && (
        <div
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50/70 px-3 py-2 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{refineError}</span>
        </div>
      )}
    </section>
  );
}
