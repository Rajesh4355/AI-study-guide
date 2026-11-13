import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import type { StudySession } from '../types/study';
import {
  computeSessionStats,
  getActiveQuizQuestions,
} from '../utils/studySession';

interface QuizStageProps {
  session: StudySession;
  onSelectAnswer: (questionId: string, optionIndex: number) => void;
  onStartWrongRetest: () => void;
  onResetFullQuiz: () => void;
  onGoToFlashcards: () => void;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export function QuizStage({
  session,
  onSelectAnswer,
  onStartWrongRetest,
  onResetFullQuiz,
  onGoToFlashcards,
}: QuizStageProps) {
  const activeQuestions = useMemo(
    () => getActiveQuizQuestions(session),
    [session]
  );
  const stats = useMemo(() => computeSessionStats(session), [session]);

  const [questionIndex, setQuestionIndex] = useState(0);

  useEffect(() => {
    setQuestionIndex(0);
  }, [session.id, session.retestRound, session.retestQuestionIds.length]);

  const safeIdx =
    activeQuestions.length > 0
      ? Math.min(questionIndex, activeQuestions.length - 1)
      : 0;
  const currentQuestion = activeQuestions[safeIdx];

  const activeAnsweredCount = activeQuestions.filter(
    (q) => session.quizAnswers[q.id] !== undefined
  ).length;
  const activeCorrectCount = activeQuestions.filter(
    (q) => session.quizAnswers[q.id] === q.correctIndex
  ).length;
  const allActiveAnswered =
    activeQuestions.length > 0 && activeAnsweredCount === activeQuestions.length;

  const isRetestMode = session.retestQuestionIds.length > 0;
  const progressPct =
    activeQuestions.length > 0
      ? (activeAnsweredCount / activeQuestions.length) * 100
      : 0;

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

      if (!currentQuestion) return;
      const selected = session.quizAnswers[currentQuestion.id];

      if (selected === undefined && ['1', '2', '3', '4'].includes(e.key)) {
        const optIdx = Number(e.key) - 1;
        if (optIdx < currentQuestion.options.length) {
          e.preventDefault();
          onSelectAnswer(currentQuestion.id, optIdx);
        }
      } else if (e.key === 'ArrowRight' && safeIdx < activeQuestions.length - 1) {
        e.preventDefault();
        setQuestionIndex((prev) => Math.min(prev + 1, activeQuestions.length - 1));
      } else if (e.key === 'ArrowLeft' && safeIdx > 0) {
        e.preventDefault();
        setQuestionIndex((prev) => Math.max(prev - 1, 0));
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    activeQuestions.length,
    currentQuestion,
    onSelectAnswer,
    safeIdx,
    session.quizAnswers,
  ]);

  if (activeQuestions.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-900">
        <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
          No quiz questions are available in this deck.
        </p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Use the refinement bar below to ask for multiple-choice questions, or review your flashcards.
        </p>
        <button
          type="button"
          onClick={onGoToFlashcards}
          className="mt-4 rounded-xl bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-700"
        >
          Back to Flashcards
        </button>
      </div>
    );
  }

  const selectedOption = currentQuestion
    ? session.quizAnswers[currentQuestion.id]
    : undefined;
  const hasAnsweredCurrent = selectedOption !== undefined;
  const isCurrentCorrect =
    hasAnsweredCurrent && selectedOption === currentQuestion.correctIndex;

  return (
    <div className="space-y-6">
      <div className="space-y-4 border-b border-slate-200/90 pb-5 dark:border-slate-800">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {isRetestMode
                ? `Re-test Round ${session.retestRound} (Wrong Answers Only)`
                : 'Full Deck Quiz'}
              <span aria-hidden="true"> · </span>
              <span className="tabular-nums">
                {activeAnsweredCount} of {activeQuestions.length} answered
              </span>
              <span aria-hidden="true"> · </span>
              <span className="tabular-nums">
                Overall accuracy {stats.accuracyPercent}%
              </span>
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl text-balance dark:text-white">
              {session.deck.title}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {isRetestMode && (
              <button
                type="button"
                onClick={onResetFullQuiz}
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 whitespace-nowrap transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Return to Full Quiz
              </button>
            )}
            <button
              type="button"
              onClick={onGoToFlashcards}
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 whitespace-nowrap transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Review Flashcards
            </button>
          </div>
        </div>

        {/* Round Progress Track */}
        <div className="flex items-center gap-3">
          <div
            aria-label="Quiz completion progress"
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
          >
            <div
              style={{ width: `${progressPct}%` }}
              className="h-full bg-sky-600 transition-all duration-300 dark:bg-sky-500"
            />
          </div>
          <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
            {activeAnsweredCount} / {activeQuestions.length}
          </span>
        </div>
      </div>

      {/* Question Index Strip */}
      <div className="flex flex-wrap items-center gap-2" role="navigation" aria-label="Quiz questions">
        {activeQuestions.map((q, idx) => {
          const ans = session.quizAnswers[q.id];
          const answered = ans !== undefined;
          const correct = answered && ans === q.correctIndex;
          const isCurrent = idx === safeIdx;

          let tone =
            'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300';
          if (answered && correct) {
            tone =
              'border-emerald-500 bg-emerald-50 text-emerald-900 dark:border-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300';
          } else if (answered && !correct) {
            tone =
              'border-red-500 bg-red-50 text-red-900 dark:border-red-600 dark:bg-red-950/40 dark:text-red-300';
          }

          return (
            <button
              key={q.id}
              type="button"
              aria-label={`Question ${idx + 1}${answered ? (correct ? ' (Correct)' : ' (Incorrect)') : ''}`}
              aria-current={isCurrent ? 'step' : undefined}
              onClick={() => setQuestionIndex(idx)}
              className={`h-9 min-w-[2.25rem] rounded-xl border px-2.5 font-mono text-xs font-semibold tabular-nums transition-all focus-visible:outline-2 focus-visible:outline-sky-600 ${tone} ${
                isCurrent ? 'ring-2 ring-sky-600 ring-offset-2 dark:ring-sky-400 dark:ring-offset-slate-950' : ''
              }`}
            >
              {idx + 1}
            </button>
          );
        })}
      </div>

      {/* Active Question Stage */}
      <div className="stage-card-shadow mx-auto max-w-3xl rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <span>
            Question {safeIdx + 1} of {activeQuestions.length}
            <span aria-hidden="true"> · </span>
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {currentQuestion.conceptTag}
            </span>
          </span>
          {!hasAnsweredCurrent && (
            <span className="hidden sm:inline">Press 1–4 to answer</span>
          )}
        </div>

        <h2 className="font-display text-lg font-semibold leading-snug text-slate-950 sm:text-xl dark:text-white">
          {currentQuestion.question}
        </h2>

        <div className="mt-6 space-y-3">
          {currentQuestion.options.map((option, optIdx) => {
            const isSelected = selectedOption === optIdx;
            const isRightOption = optIdx === currentQuestion.correctIndex;

            let optionClasses =
              'border-slate-200 bg-white text-slate-800 hover:border-sky-300 hover:bg-sky-50/40 dark:border-slate-700/90 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-700 dark:hover:bg-slate-800/80';
            let keycapClasses =
              'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400';

            if (hasAnsweredCurrent) {
              if (isRightOption) {
                optionClasses =
                  'border-emerald-600 bg-emerald-50/80 text-emerald-950 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-100';
                keycapClasses =
                  'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500 dark:text-slate-950';
              } else if (isSelected) {
                optionClasses =
                  'border-red-500 bg-red-50/80 text-red-950 dark:border-red-500 dark:bg-red-950/40 dark:text-red-100';
                keycapClasses =
                  'border-red-600 bg-red-600 text-white dark:border-red-500 dark:bg-red-500 dark:text-white';
              } else {
                optionClasses =
                  'border-slate-200/70 bg-slate-50/50 text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-500';
              }
            }

            return (
              <button
                key={`${currentQuestion.id}-opt-${optIdx}`}
                type="button"
                disabled={hasAnsweredCurrent}
                onClick={() => onSelectAnswer(currentQuestion.id, optIdx)}
                className={`flex w-full items-center gap-3.5 rounded-xl border px-4 py-3.5 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-sky-600 disabled:cursor-default ${optionClasses}`}
              >
                <span
                  className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border font-mono text-xs font-semibold ${keycapClasses}`}
                >
                  {OPTION_LETTERS[optIdx] ?? optIdx + 1}.
                </span>
                <span className="flex-1 leading-relaxed">{option}</span>
                {hasAnsweredCurrent && isRightOption && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 whitespace-nowrap dark:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    Correct
                  </span>
                )}
                {hasAnsweredCurrent && isSelected && !isRightOption && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 whitespace-nowrap dark:text-red-400">
                    <XCircle className="h-4 w-4" aria-hidden="true" />
                    Your pick
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {hasAnsweredCurrent && (
          <div
            data-testid="quiz-feedback"
            className={`mt-6 rounded-xl border p-4 ${
              isCurrentCorrect
                ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/30'
                : 'border-red-200 bg-red-50/70 dark:border-red-900/60 dark:bg-red-950/30'
            }`}
          >
            <div className="flex items-center gap-2 text-sm font-semibold">
              {isCurrentCorrect ? (
                <>
                  <CheckCircle2
                    className="h-4 w-4 text-emerald-700 dark:text-emerald-400"
                    aria-hidden="true"
                  />
                  <span className="text-emerald-900 dark:text-emerald-200">
                    Correct answer
                  </span>
                </>
              ) : (
                <>
                  <XCircle
                    className="h-4 w-4 text-red-700 dark:text-red-400"
                    aria-hidden="true"
                  />
                  <span className="text-red-900 dark:text-red-200">
                    Incorrect — queued for wrong-answer re-test
                  </span>
                </>
              )}
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              {currentQuestion.explanation}
            </p>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between gap-4 border-t border-slate-100 pt-4 dark:border-slate-800">
          <button
            type="button"
            disabled={safeIdx === 0}
            onClick={() => setQuestionIndex((prev) => Math.max(prev - 1, 0))}
            className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 whitespace-nowrap hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Previous
          </button>

          {safeIdx < activeQuestions.length - 1 ? (
            <button
              type="button"
              onClick={() =>
                setQuestionIndex((prev) =>
                  Math.min(prev + 1, activeQuestions.length - 1)
                )
              }
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white whitespace-nowrap transition-colors hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            >
              Next Question
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : (
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              End of round
            </span>
          )}
        </div>
      </div>

      {/* Round Summary & Re-test Wrong Answers */}
      {allActiveAnswered && (
        <section
          data-testid="quiz-summary"
          className="stage-card-shadow mx-auto max-w-3xl rounded-2xl border border-slate-200/90 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {isRetestMode
                  ? `Re-test Round ${session.retestRound} Complete`
                  : 'Quiz Round Complete'}
              </p>
              <h3 className="mt-1 font-display text-2xl font-bold text-slate-950 tabular-nums dark:text-white">
                {activeCorrectCount} / {activeQuestions.length} correct (
                {Math.round((activeCorrectCount / activeQuestions.length) * 100)}%)
              </h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {stats.wrongQuestionIds.length > 0
                  ? `${stats.wrongQuestionIds.length} ${
                      stats.wrongQuestionIds.length === 1 ? 'question needs' : 'questions need'
                    } another pass.`
                  : 'You answered every question in this deck correctly.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              {stats.wrongQuestionIds.length > 0 && (
                <button
                  type="button"
                  onClick={onStartWrongRetest}
                  className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white whitespace-nowrap shadow-xs transition-all hover:bg-sky-700 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-sky-600 dark:bg-sky-600 dark:text-white dark:hover:bg-sky-500"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  Re-test Wrong Answers ({stats.wrongQuestionIds.length})
                </button>
              )}

              <button
                type="button"
                onClick={onResetFullQuiz}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 whitespace-nowrap transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Retake Full Quiz
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
