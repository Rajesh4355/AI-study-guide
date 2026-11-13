import { AlertTriangle, ArrowRight, BookOpen, RotateCcw, X } from 'lucide-react';
import type {
  DifficultyLevel,
  StreamingProgressSnapshot,
  StudyErrorCode,
} from '../types/study';
import { SAMPLE_STUDY_PROMPTS } from '../utils/studySession';

export interface GenerationErrorState {
  errorCode: StudyErrorCode;
  message: string;
  rawPreview?: string;
}

interface NotesComposerProps {
  notes: string;
  difficulty: DifficultyLevel;
  cardCount: number;
  quizCount: number;
  isGenerating: boolean;
  streamProgress: StreamingProgressSnapshot | null;
  error: GenerationErrorState | null;
  hasDemoAvailable: boolean;
  onNotesChange: (value: string) => void;
  onDifficultyChange: (level: DifficultyLevel) => void;
  onDeckSizeChange: (cards: number, quiz: number) => void;
  onGenerate: () => void;
  onCancel: () => void;
  onRetry: () => void;
  onOpenDemo: () => void;
}

const DECK_SIZE_PRESETS = [
  { label: 'Compact (5 cards · 4 quiz)', cards: 5, quiz: 4 },
  { label: 'Standard (6 cards · 5 quiz)', cards: 6, quiz: 5 },
  { label: 'Deep Dive (10 cards · 7 quiz)', cards: 10, quiz: 7 },
];

export function NotesComposer({
  notes,
  difficulty,
  cardCount,
  quizCount,
  isGenerating,
  streamProgress,
  error,
  hasDemoAvailable,
  onNotesChange,
  onDifficultyChange,
  onDeckSizeChange,
  onGenerate,
  onCancel,
  onRetry,
  onOpenDemo,
}: NotesComposerProps) {
  const trimmedLen = notes.trim().length;
  const isTooShort = trimmedLen > 0 && trimmedLen < 10;
  const isTooLong = trimmedLen > 20000;
  const canSubmit = trimmedLen >= 10 && !isTooLong && !isGenerating;

  const selectedSizeKey = `${cardCount}-${quizCount}`;

  return (
    <div className="space-y-8">
      {/* Editorial Hero Lead */}
      <div className="max-w-2xl">
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl text-balance dark:text-white">
          Turn raw notes into an active study deck
        </h1>
        <p className="mt-2.5 text-base leading-relaxed text-slate-600 dark:text-slate-400">
          Paste lecture notes, textbook excerpts, or a topic prompt. StudyDeck converts your material into active-recall flashcards and a multiple-choice quiz with wrong-answer re-testing.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
        {/* Primary Focal Stage: Notes Composer */}
        <section className="lg:col-span-8">
          <div className="stage-card-shadow rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-7 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4">
              <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="study-notes-input"
                  className="text-sm font-semibold text-slate-900 dark:text-slate-100"
                >
                  Study notes or topic
                </label>
                <span
                  className={`font-mono text-xs tabular-nums ${
                    isTooLong
                      ? 'font-medium text-red-600 dark:text-red-400'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {trimmedLen.toLocaleString()} / 20,000 chars
                </span>
              </div>

              <textarea
                id="study-notes-input"
                rows={9}
                value={notes}
                onChange={(e) => onNotesChange(e.target.value)}
                disabled={isGenerating}
                placeholder="Paste notes, definitions, processes, or a topic prompt (e.g., 'Explain how TLS 1.3 handshakes work, including forward secrecy and 1-RTT key exchange')..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3.5 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 transition-colors focus:border-sky-600 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-600/10 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700/90 dark:bg-slate-950/60 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-sky-400 dark:focus:bg-slate-950 dark:focus:ring-sky-400/10"
              />

              {isTooShort && (
                <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-400">
                  Add a few more words (minimum 10 characters) so the AI has enough context.
                </p>
              )}
              {isTooLong && (
                <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">
                  Notes exceed 20,000 characters. Trim them down before generating.
                </p>
              )}
            </div>

            <div className="mb-6">
              <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                Load sample notes
              </p>
              <div className="flex flex-wrap gap-2">
                {SAMPLE_STUDY_PROMPTS.map((sample) => (
                  <button
                    key={sample.id}
                    type="button"
                    disabled={isGenerating}
                    onClick={() => {
                      onNotesChange(sample.notes);
                      onDifficultyChange(sample.difficulty);
                    }}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 whitespace-nowrap transition-colors hover:border-sky-300 hover:bg-sky-50/60 hover:text-sky-900 focus-visible:outline-2 focus-visible:outline-sky-600 disabled:opacity-50 dark:border-slate-700/80 dark:bg-slate-800/70 dark:text-slate-300 dark:hover:border-sky-700 dark:hover:bg-slate-800 dark:hover:text-white"
                  >
                    {sample.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 border-t border-slate-100 pt-5 sm:grid-cols-2 dark:border-slate-800">
              <div>
                <span className="mb-2 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Question Depth
                </span>
                <div
                  role="group"
                  aria-label="Question difficulty"
                  className="inline-flex w-full rounded-xl bg-slate-100 p-1 dark:bg-slate-800/90"
                >
                  {(['introductory', 'intermediate', 'advanced'] as const).map((level) => {
                    const active = difficulty === level;
                    return (
                      <button
                        key={level}
                        type="button"
                        disabled={isGenerating}
                        onClick={() => onDifficultyChange(level)}
                        className={`flex-1 rounded-lg px-2.5 py-2 text-xs font-medium capitalize whitespace-nowrap transition-all focus-visible:outline-2 focus-visible:outline-sky-600 ${
                          active
                            ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                            : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                        }`}
                      >
                        {level}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label
                  htmlFor="deck-size-select"
                  className="mb-2 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Deck Size
                </label>
                <select
                  id="deck-size-select"
                  value={selectedSizeKey}
                  disabled={isGenerating}
                  onChange={(e) => {
                    const match = DECK_SIZE_PRESETS.find(
                      (p) => `${p.cards}-${p.quiz}` === e.target.value
                    );
                    if (match) onDeckSizeChange(match.cards, match.quiz);
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-800 transition-colors focus:border-sky-600 focus:outline-none focus:ring-4 focus:ring-sky-600/10 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  {DECK_SIZE_PRESETS.map((preset) => (
                    <option key={preset.label} value={`${preset.cards}-${preset.quiz}`}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {isGenerating && (
              <div
                role="status"
                aria-live="polite"
                data-testid="generation-loading"
                className="mt-5 rounded-xl border border-sky-200/80 bg-sky-50/50 p-4 dark:border-sky-900/50 dark:bg-sky-950/25"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {streamProgress?.title
                        ? `Building "${streamProgress.title}"`
                        : 'Structuring flashcards and quiz questions...'}
                    </p>
                    <p className="mt-1 font-mono text-xs tabular-nums text-slate-600 dark:text-slate-400">
                      {streamProgress
                        ? `${streamProgress.subject ? `${streamProgress.subject} · ` : ''}${streamProgress.flashcardCount} cards drafted · ${streamProgress.quizCount} quiz items drafted`
                        : 'Waiting for structured response stream...'}
                    </p>
                  </div>
                  <span className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-slate-300 border-t-sky-600 dark:border-slate-700 dark:border-t-sky-400" />
                </div>

                <div className="mt-4 space-y-2.5" aria-hidden="true">
                  <div className="h-3.5 w-2/3 animate-pulse rounded bg-sky-200/60 dark:bg-slate-800" />
                  <div className="h-14 w-full animate-pulse rounded-lg bg-sky-100/70 dark:bg-slate-800/70" />
                </div>
              </div>
            )}

            {error && !isGenerating && (
              <div
                role="alert"
                data-testid="generation-error"
                className="mt-5 rounded-xl border border-red-200 bg-red-50/80 p-4 dark:border-red-900/60 dark:bg-red-950/30"
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle
                    className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-semibold text-red-900 dark:text-red-200">
                      Could not generate study deck ({error.errorCode.replace(/_/g, ' ')})
                    </h2>
                    <p className="mt-1 text-sm text-red-800 dark:text-red-300">
                      {error.message}
                    </p>

                    {error.rawPreview && (
                      <details className="mt-2.5">
                        <summary className="cursor-pointer text-xs font-medium text-red-700 underline underline-offset-2 dark:text-red-300">
                          Inspect raw output snippet
                        </summary>
                        <pre className="mt-2 overflow-x-auto rounded-lg border border-red-200 bg-white/90 p-3 font-mono text-xs text-slate-700 dark:border-red-900/50 dark:bg-slate-950 dark:text-slate-300">
                          {error.rawPreview}
                        </pre>
                      </details>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={onRetry}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-2 text-xs font-semibold text-white whitespace-nowrap transition-colors hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-red-600 dark:bg-red-600 dark:text-white dark:hover:bg-red-500"
                      >
                        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                        Retry Generation
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              {isGenerating ? (
                <button
                  type="button"
                  onClick={onCancel}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 whitespace-nowrap transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-sky-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                  Cancel Generation
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!canSubmit}
                  onClick={onGenerate}
                  className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white whitespace-nowrap shadow-xs transition-all hover:bg-sky-700 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none dark:bg-sky-600 dark:text-white dark:hover:bg-sky-500 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
                >
                  Generate Study Deck
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              )}

              {notes.trim().length > 0 && !isGenerating && (
                <button
                  type="button"
                  onClick={() => onNotesChange('')}
                  className="px-3 py-2 text-xs font-medium text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                >
                  Clear notes
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Unified Architectural Sidebar */}
        <aside className="lg:col-span-4">
          <div className="divide-y divide-slate-200/80 rounded-2xl border border-slate-200/90 bg-white/75 dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900/70">
            <div className="p-6">
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                How StudyDeck works
              </h2>
              <ol className="mt-4 space-y-4 text-sm">
                <li>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    01. Structured Extraction
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                    Notes are validated into typed flashcards, concept labels, and 4-option questions.
                  </p>
                </li>
                <li>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    02. Active Recall Flipping
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                    Flip cards with Spacebar or click, reveal hints, and track Mastered vs. Review items.
                  </p>
                </li>
                <li>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    03. Wrong-Answer Re-testing
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                    Missed questions are isolated into focused re-test rounds until you reach 100%.
                  </p>
                </li>
              </ol>
            </div>

            {hasDemoAvailable && (
              <div className="p-6">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Ready-to-study sample · Biology
                </p>
                <h2 className="mt-1 font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                  Cellular Respiration &amp; ATP
                </h2>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  5 flashcards and 4 quiz questions ready to flip, grade, and re-test immediately.
                </p>
                <button
                  type="button"
                  onClick={onOpenDemo}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-800 whitespace-nowrap transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-sky-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                >
                  <BookOpen className="h-4 w-4" aria-hidden="true" />
                  Open Sample Deck
                </button>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
