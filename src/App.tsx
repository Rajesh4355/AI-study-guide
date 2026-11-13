import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Moon, Sun, X } from 'lucide-react';
import { Header, type AppView } from './components/Header';
import {
  NotesComposer,
  type GenerationErrorState,
} from './components/NotesComposer';
import { FlashcardStage } from './components/FlashcardStage';
import { QuizStage } from './components/QuizStage';
import { DeckRefineBar } from './components/DeckRefineBar';
import { SavedSessionsView } from './components/SavedSessionsView';
import type {
  CardStatus,
  DifficultyLevel,
  StreamingProgressSnapshot,
  StudySession,
} from './types/study';
import { generateStudyDeck, refineStudyDeck } from './utils/studyApi';
import {
  applyDeckRefinement,
  createStudySession,
  DEMO_STUDY_SESSION,
  resetFullQuiz,
  shouldAcceptAsyncResponse,
  startWrongAnswerRetest,
} from './utils/studySession';
import {
  loadActiveSessionId,
  loadSavedSessions,
  loadThemeMode,
  saveActiveSessionId,
  saveSessions,
  saveThemeMode,
  type ThemeMode,
} from './utils/storage';

function getInitialView(hasActiveSession: boolean): AppView {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1' && hasActiveSession) {
      return 'flashcards';
    }
  } catch {
    // Ignore URL parsing issues
  }
  return 'create';
}

export default function App() {
  const [sessions, setSessions] = useState<StudySession[]>(() => loadSavedSessions());
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    const loaded = loadSavedSessions();
    const savedId = loadActiveSessionId();
    if (savedId && loaded.some((s) => s.id === savedId)) {
      return savedId;
    }
    return loaded[0]?.id ?? null;
  });

  const [activeView, setActiveView] = useState<AppView>(() => {
    const loaded = loadSavedSessions();
    return getInitialView(loaded.length > 0);
  });

  const [theme, setTheme] = useState<ThemeMode>(() => loadThemeMode());

  // Composer state
  const [notes, setNotes] = useState('');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('intermediate');
  const [cardCount, setCardCount] = useState(6);
  const [quizCount, setQuizCount] = useState(5);

  // Generation async state + race protection
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamProgress, setStreamProgress] =
    useState<StreamingProgressSnapshot | null>(null);
  const [generationError, setGenerationError] =
    useState<GenerationErrorState | null>(null);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);

  // Refinement async state + race protection
  const [isRefining, setIsRefining] = useState(false);
  const [refineError, setRefineError] = useState<string | null>(null);

  const generateRequestIdRef = useRef(0);
  const generateAbortRef = useRef<AbortController | null>(null);
  const refineRequestIdRef = useRef(0);
  const refineAbortRef = useRef<AbortController | null>(null);

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) ?? null,
    [sessions, activeSessionId]
  );

  // Sync theme class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    saveThemeMode(theme);
  }, [theme]);

  // Persist sessions & active session id
  useEffect(() => {
    saveSessions(sessions);
  }, [sessions]);

  useEffect(() => {
    saveActiveSessionId(activeSessionId);
  }, [activeSessionId]);

  // Cleanup active requests on unmount
  useEffect(() => {
    return () => {
      generateAbortRef.current?.abort();
      refineAbortRef.current?.abort();
    };
  }, []);

  const updateActiveSession = useCallback(
    (updater: (session: StudySession) => StudySession) => {
      if (!activeSessionId) return;
      setSessions((prev) =>
        prev.map((s) => (s.id === activeSessionId ? updater(s) : s))
      );
    },
    [activeSessionId]
  );

  const handleCancelGeneration = useCallback(() => {
    generateRequestIdRef.current += 1;
    generateAbortRef.current?.abort();
    generateAbortRef.current = null;
    setIsGenerating(false);
    setStreamProgress(null);
  }, []);

  const handleGenerate = useCallback(async () => {
    const trimmed = notes.trim();
    if (trimmed.length < 10) return;

    generateAbortRef.current?.abort();
    const controller = new AbortController();
    generateAbortRef.current = controller;

    const requestId = ++generateRequestIdRef.current;
    setIsGenerating(true);
    setGenerationError(null);
    setStreamProgress(null);
    setParseWarnings([]);

    try {
      const result = await generateStudyDeck({
        notes: trimmed,
        difficulty,
        cardCount,
        quizCount,
        signal: controller.signal,
        onProgress: (snapshot) => {
          if (
            shouldAcceptAsyncResponse(
              generateRequestIdRef.current,
              requestId,
              controller.signal.aborted
            )
          ) {
            setStreamProgress(snapshot);
          }
        },
      });

      if (
        !shouldAcceptAsyncResponse(
          generateRequestIdRef.current,
          requestId,
          controller.signal.aborted
        )
      ) {
        return;
      }

      if (!result.ok) {
        setGenerationError({
          errorCode: result.errorCode,
          message: result.message,
          rawPreview: result.rawPreview,
        });
        return;
      }

      const newSession = createStudySession({
        id: `deck-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        sourceText: trimmed,
        difficulty,
        deck: result.deck,
      });

      setSessions((prev) => [newSession, ...prev]);
      setActiveSessionId(newSession.id);
      setParseWarnings(result.warnings);
      setActiveView('flashcards');
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      if (
        shouldAcceptAsyncResponse(
          generateRequestIdRef.current,
          requestId,
          controller.signal.aborted
        )
      ) {
        setGenerationError({
          errorCode: 'NETWORK_ERROR',
          message: 'Unexpected error while generating your study deck. Please retry.',
        });
      }
    } finally {
      if (generateRequestIdRef.current === requestId) {
        setIsGenerating(false);
        setStreamProgress(null);
      }
    }
  }, [notes, difficulty, cardCount, quizCount]);

  const handleRefineDeck = useCallback(
    async (instruction: string): Promise<boolean> => {
      if (!activeSession) return false;

      refineAbortRef.current?.abort();
      const controller = new AbortController();
      refineAbortRef.current = controller;

      const requestId = ++refineRequestIdRef.current;
      const targetSessionId = activeSession.id;
      setIsRefining(true);
      setRefineError(null);

      try {
        const result = await refineStudyDeck({
          currentDeck: activeSession.deck,
          sourceText: activeSession.sourceText,
          instruction,
          signal: controller.signal,
        });

        if (
          !shouldAcceptAsyncResponse(
            refineRequestIdRef.current,
            requestId,
            controller.signal.aborted
          )
        ) {
          return false;
        }

        if (!result.ok) {
          setRefineError(result.message);
          return false;
        }

        setSessions((prev) =>
          prev.map((s) =>
            s.id === targetSessionId ? applyDeckRefinement(s, result.deck) : s
          )
        );
        if (result.warnings.length > 0) {
          setParseWarnings(result.warnings);
        }
        return true;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return false;
        }
        if (
          shouldAcceptAsyncResponse(
            refineRequestIdRef.current,
            requestId,
            controller.signal.aborted
          )
        ) {
          setRefineError('Could not update the deck right now. Please retry.');
        }
        return false;
      } finally {
        if (refineRequestIdRef.current === requestId) {
          setIsRefining(false);
        }
      }
    },
    [activeSession]
  );

  const handleOpenDemo = useCallback(() => {
    setSessions((prev) => {
      const existing = prev.find((s) => s.id === DEMO_STUDY_SESSION.id);
      if (existing) return prev;
      return [DEMO_STUDY_SESSION, ...prev];
    });
    setActiveSessionId(DEMO_STUDY_SESSION.id);
    setParseWarnings([]);
    setActiveView('flashcards');
  }, []);

  const handleSetCardStatus = useCallback(
    (cardId: string, status: CardStatus) => {
      updateActiveSession((session) => ({
        ...session,
        updatedAt: new Date().toISOString(),
        cardStatuses: {
          ...session.cardStatuses,
          [cardId]: status,
        },
      }));
    },
    [updateActiveSession]
  );

  const handleSelectQuizAnswer = useCallback(
    (questionId: string, optionIndex: number) => {
      updateActiveSession((session) => ({
        ...session,
        updatedAt: new Date().toISOString(),
        quizAnswers: {
          ...session.quizAnswers,
          [questionId]: optionIndex,
        },
      }));
    },
    [updateActiveSession]
  );

  const handleStartWrongRetest = useCallback(() => {
    updateActiveSession((session) => startWrongAnswerRetest(session));
    window.scrollTo({ top: 0 });
  }, [updateActiveSession]);

  const handleResetFullQuiz = useCallback(() => {
    updateActiveSession((session) => resetFullQuiz(session));
    window.scrollTo({ top: 0 });
  }, [updateActiveSession]);

  const navigateToView = useCallback((view: AppView) => {
    setActiveView(view);
    window.scrollTo({ top: 0 });
  }, []);

  const handleDeleteSession = useCallback(
    (sessionId: string) => {
      setSessions((prev) => {
        const remaining = prev.filter((s) => s.id !== sessionId);
        if (activeSessionId === sessionId) {
          const nextId = remaining[0]?.id ?? null;
          setActiveSessionId(nextId);
          if (!nextId && (activeView === 'flashcards' || activeView === 'quiz')) {
            setActiveView('create');
          }
        }
        return remaining;
      });
    },
    [activeSessionId, activeView]
  );

  const mobileTabs: Array<{ id: AppView; label: string; disabled?: boolean }> = [
    { id: 'create', label: 'Create' },
    { id: 'flashcards', label: 'Cards', disabled: !activeSession },
    { id: 'quiz', label: 'Quiz', disabled: !activeSession },
    { id: 'saved', label: `Saved (${sessions.length})` },
  ];

  return (
    <div className="studio-canvas min-h-screen flex flex-col text-slate-900 dark:text-slate-100">
      <Header
        activeView={activeView}
        hasActiveDeck={Boolean(activeSession)}
        savedCount={sessions.length}
        onNavigate={navigateToView}
        onNewDeck={() => navigateToView('create')}
      />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {/* Workspace Context & Theme Toolbar */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 md:hidden" role="navigation" aria-label="Mobile view switcher">
            <div className="flex items-center gap-1 rounded-lg bg-slate-200/70 p-1 dark:bg-slate-800">
              {mobileTabs.map((tab) => {
                const isActive = activeView === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    disabled={tab.disabled}
                    onClick={() => navigateToView(tab.id)}
                    className={`rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                      tab.disabled
                        ? 'cursor-not-allowed text-slate-400 dark:text-slate-600'
                        : isActive
                        ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="hidden md:block text-xs text-slate-500 dark:text-slate-400">
            {activeSession ? (
              <span>
                Active deck: <strong className="font-semibold text-slate-700 dark:text-slate-200">{activeSession.deck.title}</strong>
              </span>
            ) : (
              <span>No active deck selected</span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 whitespace-nowrap transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-sky-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="h-3.5 w-3.5" aria-hidden="true" />
                Light mode
              </>
            ) : (
              <>
                <Moon className="h-3.5 w-3.5" aria-hidden="true" />
                Dark mode
              </>
            )}
          </button>
        </div>

        {/* Non-blocking recovery warning banner if AI output needed sanitization */}
        {parseWarnings.length > 0 && activeView !== 'create' && (
          <div
            role="status"
            className="mb-6 flex items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-semibold">
                  Recovered structured deck with {parseWarnings.length}{' '}
                  {parseWarnings.length === 1 ? 'adjustment' : 'adjustments'}
                </p>
                <p className="mt-0.5 text-amber-800 dark:text-amber-300">
                  {parseWarnings.join(' ')}
                </p>
              </div>
            </div>
            <button
              type="button"
              aria-label="Dismiss recovery warning"
              onClick={() => setParseWarnings([])}
              className="rounded p-1 hover:bg-amber-100 dark:hover:bg-amber-900/40"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        )}

        {activeView === 'create' && (
          <NotesComposer
            notes={notes}
            difficulty={difficulty}
            cardCount={cardCount}
            quizCount={quizCount}
            isGenerating={isGenerating}
            streamProgress={streamProgress}
            error={generationError}
            hasDemoAvailable={true}
            onNotesChange={(value) => {
              if (generationError) setGenerationError(null);
              setNotes(value);
            }}
            onDifficultyChange={setDifficulty}
            onDeckSizeChange={(cards, quiz) => {
              setCardCount(cards);
              setQuizCount(quiz);
            }}
            onGenerate={handleGenerate}
            onCancel={handleCancelGeneration}
            onRetry={handleGenerate}
            onOpenDemo={handleOpenDemo}
          />
        )}

        {activeView === 'flashcards' && activeSession && (
          <>
            <FlashcardStage
              session={activeSession}
              onSetCardStatus={handleSetCardStatus}
              onGoToQuiz={() => navigateToView('quiz')}
            />
            <DeckRefineBar
              isRefining={isRefining}
              refineError={refineError}
              onRefine={handleRefineDeck}
              onClearError={() => setRefineError(null)}
            />
          </>
        )}

        {activeView === 'quiz' && activeSession && (
          <>
            <QuizStage
              session={activeSession}
              onSelectAnswer={handleSelectQuizAnswer}
              onStartWrongRetest={handleStartWrongRetest}
              onResetFullQuiz={handleResetFullQuiz}
              onGoToFlashcards={() => navigateToView('flashcards')}
            />
            <DeckRefineBar
              isRefining={isRefining}
              refineError={refineError}
              onRefine={handleRefineDeck}
              onClearError={() => setRefineError(null)}
            />
          </>
        )}

        {activeView === 'saved' && (
          <SavedSessionsView
            sessions={sessions}
            activeSessionId={activeSessionId}
            onOpenSession={(id) => {
              setActiveSessionId(id);
              setParseWarnings([]);
              navigateToView('flashcards');
            }}
            onDeleteSession={handleDeleteSession}
            onCreateNew={() => navigateToView('create')}
            onRestoreDemo={handleOpenDemo}
          />
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white/60 py-4 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
        StudyDeck · Structured Active Recall &amp; Quiz Studio
      </footer>
    </div>
  );
}
