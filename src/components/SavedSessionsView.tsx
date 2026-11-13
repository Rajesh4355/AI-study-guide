import { BookOpen, Trash2 } from 'lucide-react';
import type { StudySession } from '../types/study';
import { computeSessionStats } from '../utils/studySession';

interface SavedSessionsViewProps {
  sessions: StudySession[];
  activeSessionId: string | null;
  onOpenSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onCreateNew: () => void;
  onRestoreDemo: () => void;
}

function formatShortDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return 'Recently';
  }
}

export function SavedSessionsView({
  sessions,
  activeSessionId,
  onOpenSession,
  onDeleteSession,
  onCreateNew,
  onRestoreDemo,
}: SavedSessionsViewProps) {
  if (sessions.length === 0) {
    return (
      <div className="stage-card-shadow rounded-2xl border border-slate-200/90 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
        <h1 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100">
          No saved study decks yet
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Generate a deck from your notes or restore the sample Biology deck to get started.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={onCreateNew}
            className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 dark:bg-sky-600 dark:text-white"
          >
            Create First Deck
          </button>
          <button
            type="button"
            onClick={onRestoreDemo}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            Restore Sample Deck
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200/90 pb-4 dark:border-slate-800">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl dark:text-white">
            Saved study sessions
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            All decks and mastery progress are saved automatically in your browser.
          </p>
        </div>
        <button
          type="button"
          onClick={onCreateNew}
          className="rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-semibold text-white whitespace-nowrap shadow-xs transition-colors hover:bg-sky-700 dark:bg-sky-600 dark:hover:bg-sky-500"
        >
          New Study Deck
        </button>
      </div>

      <div className="stage-card-shadow divide-y divide-slate-200/80 overflow-hidden rounded-2xl border border-slate-200/90 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
        {sessions.map((session) => {
          const stats = computeSessionStats(session);
          const isCurrent = session.id === activeSessionId;
          const masteryPct =
            stats.totalCards > 0
              ? Math.round((stats.masteredCount / stats.totalCards) * 100)
              : 0;

          return (
            <div
              key={session.id}
              className="flex flex-col gap-4 p-5 transition-colors hover:bg-slate-50/70 sm:flex-row sm:items-center sm:justify-between sm:p-6 dark:hover:bg-slate-800/40"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {session.deck.subject}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">
                    {stats.totalCards} cards ({stats.masteredCount} mastered)
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">
                    {stats.totalQuiz} quiz (
                    {stats.answeredCount > 0 ? `${stats.accuracyPercent}%` : 'not taken'})
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>Updated {formatShortDate(session.updatedAt)}</span>
                </div>

                <h2 className="mt-1 font-display text-lg font-semibold text-slate-950 dark:text-white">
                  {session.deck.title}
                  {isCurrent && (
                    <span className="ml-2 font-sans text-xs font-medium text-sky-700 dark:text-sky-400">
                      (Active)
                    </span>
                  )}
                </h2>
                <p className="mt-1 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">
                  {session.deck.summary}
                </p>

                <div className="mt-3 flex max-w-xs items-center gap-2.5">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                    <div
                      style={{ width: `${masteryPct}%` }}
                      className="h-full bg-emerald-600 dark:bg-emerald-500"
                    />
                  </div>
                  <span className="font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                    {masteryPct}%
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onOpenSession(session.id)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 whitespace-nowrap transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-sky-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                >
                  <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                  Open Deck
                </button>
                <button
                  type="button"
                  aria-label={`Delete "${session.deck.title}"`}
                  onClick={() => onDeleteSession(session.id)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-red-600 dark:border-slate-800 dark:text-slate-400 dark:hover:border-red-900/60 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
