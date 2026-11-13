import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  RotateCcw,
  Shuffle,
} from 'lucide-react';
import type { CardStatus, Flashcard, StudySession } from '../types/study';
import { computeSessionStats } from '../utils/studySession';

type CardFilter = 'all' | 'review' | 'unseen' | 'mastered';

interface FlashcardStageProps {
  session: StudySession;
  onSetCardStatus: (cardId: string, status: CardStatus) => void;
  onGoToQuiz: () => void;
}

export function FlashcardStage({
  session,
  onSetCardStatus,
  onGoToQuiz,
}: FlashcardStageProps) {
  const [filter, setFilter] = useState<CardFilter>('all');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [customOrder, setCustomOrder] = useState<string[] | null>(null);

  const stats = useMemo(() => computeSessionStats(session), [session]);

  const orderedCards = useMemo(() => {
    const cards = session.deck.flashcards;
    if (!customOrder) return cards;
    const byId = new Map(cards.map((c) => [c.id, c]));
    const arranged: Flashcard[] = [];
    for (const id of customOrder) {
      const card = byId.get(id);
      if (card) {
        arranged.push(card);
        byId.delete(id);
      }
    }
    for (const remaining of byId.values()) {
      arranged.push(remaining);
    }
    return arranged;
  }, [session.deck.flashcards, customOrder]);

  const filteredCards = useMemo(() => {
    if (filter === 'all') return orderedCards;
    return orderedCards.filter(
      (c) => (session.cardStatuses[c.id] ?? 'unseen') === filter
    );
  }, [orderedCards, filter, session.cardStatuses]);

  const safeIndex =
    filteredCards.length > 0 ? Math.min(currentIndex, filteredCards.length - 1) : 0;
  const currentCard = filteredCards[safeIndex];
  const currentStatus: CardStatus = currentCard
    ? session.cardStatuses[currentCard.id] ?? 'unseen'
    : 'unseen';

  const handleStep = useCallback(
    (delta: number) => {
      if (filteredCards.length === 0) return;
      setIsFlipped(false);
      setShowHint(false);
      setCurrentIndex((prev) => {
        const clamped = Math.min(prev, filteredCards.length - 1);
        return (clamped + delta + filteredCards.length) % filteredCards.length;
      });
    },
    [filteredCards.length]
  );

  const handleShuffle = () => {
    const ids = session.deck.flashcards.map((c) => c.id);
    for (let i = ids.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    setCustomOrder(ids);
    setCurrentIndex(0);
    setIsFlipped(false);
    setShowHint(false);
  };

  const handleGrade = useCallback(
    (status: CardStatus) => {
      if (!currentCard) return;
      onSetCardStatus(currentCard.id, status);
      if (filteredCards.length > 1) {
        setIsFlipped(false);
        setShowHint(false);
        setCurrentIndex((prev) => (prev + 1) % filteredCards.length);
      }
    },
    [currentCard, filteredCards.length, onSetCardStatus]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        if (currentCard) setIsFlipped((prev) => !prev);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleStep(1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleStep(-1);
      } else if (e.key === '1' && isFlipped) {
        e.preventDefault();
        handleGrade('review');
      } else if (e.key === '2' && isFlipped) {
        e.preventDefault();
        handleGrade('mastered');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentCard, handleGrade, handleStep, isFlipped]);

  const filterTabs: Array<{ id: CardFilter; label: string; count: number }> = [
    { id: 'all', label: 'All Cards', count: stats.totalCards },
    { id: 'review', label: 'Needs Review', count: stats.reviewCount },
    { id: 'unseen', label: 'Unseen', count: stats.unseenCount },
    { id: 'mastered', label: 'Mastered', count: stats.masteredCount },
  ];

  const masteredPct =
    stats.totalCards > 0 ? (stats.masteredCount / stats.totalCards) * 100 : 0;
  const reviewPct =
    stats.totalCards > 0 ? (stats.reviewCount / stats.totalCards) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Deck Header + Mastery Bar */}
      <div className="space-y-4 border-b border-slate-200/90 pb-6 dark:border-slate-800">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {session.deck.subject}
              <span aria-hidden="true"> · </span>
              <span className="capitalize">{session.difficulty}</span>
              <span aria-hidden="true"> · </span>
              <span className="tabular-nums">
                {stats.masteredCount} of {stats.totalCards} mastered
              </span>
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl text-balance dark:text-white">
              {session.deck.title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {session.deck.summary}
            </p>
            {session.deck.keyConcepts.length > 0 && (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Key concepts:
                </span>{' '}
                {session.deck.keyConcepts.join(' · ')}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onGoToQuiz}
            className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white whitespace-nowrap shrink-0 shadow-xs transition-all hover:bg-sky-700 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-sky-600 dark:bg-sky-600 dark:text-white dark:hover:bg-sky-500"
          >
            Take Quiz ({stats.totalQuiz})
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Segmented Mastery Track */}
        <div className="flex items-center gap-3">
          <div
            aria-label="Deck mastery progress"
            className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
          >
            <div
              style={{ width: `${masteredPct}%` }}
              className="bg-emerald-600 transition-all duration-300 dark:bg-emerald-500"
            />
            <div
              style={{ width: `${reviewPct}%` }}
              className="bg-amber-500 transition-all duration-300 dark:bg-amber-400"
            />
          </div>
          <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
            {Math.round(masteredPct)}% mastered
          </span>
        </div>
      </div>

      {/* Filter & Shuffle Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Filter flashcards by mastery"
          className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-200/70 p-1 dark:bg-slate-800/80"
        >
          {filterTabs.map((tab) => {
            const active = filter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setFilter(tab.id);
                  setCurrentIndex(0);
                  setIsFlipped(false);
                  setShowHint(false);
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:outline-2 focus-visible:outline-sky-600 ${
                  active
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {tab.label}{' '}
                <span className="font-mono tabular-nums opacity-75">
                  ({tab.count})
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleShuffle}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 whitespace-nowrap transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-sky-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <Shuffle className="h-3.5 w-3.5" aria-hidden="true" />
          Shuffle
        </button>
      </div>

      {!currentCard ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-900">
          <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
            No flashcards in "{filterTabs.find((t) => t.id === filter)?.label}"
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Switch back to All Cards or mark cards as you study.
          </p>
          <button
            type="button"
            onClick={() => setFilter('all')}
            className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
          >
            Show All Cards
          </button>
        </div>
      ) : (
        <div className="mx-auto max-w-3xl space-y-6">
          {/* Tactile Physical Deck Stack */}
          <div className="perspective-1200 relative pb-2">
            {filteredCards.length > 1 && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-4 top-2.5 bottom-0 rounded-2xl border border-slate-200/80 bg-white/60 dark:border-slate-800 dark:bg-slate-900/50"
              />
            )}

            <button
              type="button"
              data-testid="flashcard-flip-surface"
              aria-label={
                isFlipped
                  ? `Showing answer for card ${safeIndex + 1}. Click to show prompt.`
                  : `Showing prompt for card ${safeIndex + 1}. Click to reveal answer.`
              }
              aria-pressed={isFlipped}
              onClick={() => setIsFlipped((prev) => !prev)}
              className="relative block min-h-[320px] w-full rounded-2xl text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-600"
            >
              <div
                className={`preserve-3d flip-curve relative min-h-[320px] w-full transition-transform duration-300 ${
                  isFlipped ? 'rotate-y-180' : ''
                }`}
              >
                {/* Front Face */}
                <div className="backface-hidden stage-card-shadow absolute inset-0 flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-9 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
                    <span>
                      Prompt
                      <span aria-hidden="true"> · </span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {currentCard.conceptTag}
                      </span>
                    </span>
                    <span
                      className={`font-mono tabular-nums ${
                        currentStatus === 'mastered'
                          ? 'font-medium text-emerald-700 dark:text-emerald-400'
                          : currentStatus === 'review'
                          ? 'font-medium text-amber-700 dark:text-amber-400'
                          : ''
                      }`}
                    >
                      {currentStatus === 'mastered'
                        ? 'Mastered'
                        : currentStatus === 'review'
                        ? 'Needs Review'
                        : 'Unseen'}
                    </span>
                  </div>

                  <div className="my-auto py-5">
                    <p className="font-display text-xl font-semibold leading-snug text-slate-950 sm:text-2xl dark:text-white">
                      {currentCard.front}
                    </p>
                    {currentCard.hint && showHint && (
                      <p className="mt-4 rounded-lg bg-sky-50/80 px-3.5 py-2.5 text-sm text-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
                        Hint: {currentCard.hint}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    <span>Click card or press Space to flip</span>
                  </div>
                </div>

                {/* Back Face */}
                <div className="backface-hidden rotate-y-180 stage-card-shadow absolute inset-0 flex flex-col justify-between rounded-2xl border border-sky-200 bg-sky-50/50 p-6 sm:p-9 dark:border-sky-800/70 dark:bg-slate-900">
                  <div className="flex items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
                    <span>
                      Answer
                      <span aria-hidden="true"> · </span>
                      <span className="font-medium text-sky-800 dark:text-sky-300">
                        {currentCard.conceptTag}
                      </span>
                    </span>
                    <span className="font-mono tabular-nums">
                      Card {safeIndex + 1} / {filteredCards.length}
                    </span>
                  </div>

                  <div className="my-auto py-5">
                    <p className="text-base leading-relaxed text-slate-900 sm:text-lg dark:text-slate-100">
                      {currentCard.back}
                    </p>
                  </div>

                  <div className="border-t border-sky-200/60 pt-4 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-400">
                    Click card or press Space to flip back · Keys 1 (Review) or 2 (Mastered)
                  </div>
                </div>
              </div>
            </button>

            {currentCard.hint && !isFlipped && (
              <button
                type="button"
                onClick={() => setShowHint((prev) => !prev)}
                className="absolute right-6 bottom-6 z-10 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-sky-700 transition-colors hover:bg-sky-50 hover:text-sky-800 focus-visible:outline-2 focus-visible:outline-sky-600 sm:right-9 sm:bottom-7 dark:text-sky-400 dark:hover:bg-sky-950/50 dark:hover:text-sky-300"
              >
                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                {showHint ? 'Hide Hint' : 'Show Hint'}
              </button>
            )}
          </div>

          {/* Stepper & Grading Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Previous flashcard"
                onClick={() => handleStep(-1)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 whitespace-nowrap transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-sky-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Previous
              </button>

              <span className="px-2.5 font-mono text-xs tabular-nums text-slate-600 dark:text-slate-400">
                {safeIndex + 1} / {filteredCards.length}
              </span>

              <button
                type="button"
                aria-label="Next flashcard"
                onClick={() => handleStep(1)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 whitespace-nowrap transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-sky-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Next
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => handleGrade('review')}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2.5 text-xs font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-amber-600 ${
                  currentStatus === 'review'
                    ? 'border-amber-500 bg-amber-50 text-amber-900 dark:border-amber-500/70 dark:bg-amber-950/40 dark:text-amber-300'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-amber-300 hover:bg-amber-50/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                Needs Review
              </button>

              <button
                type="button"
                onClick={() => handleGrade('mastered')}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2.5 text-xs font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-emerald-600 ${
                  currentStatus === 'mastered'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900 dark:border-emerald-500/70 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                Mark Mastered
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
