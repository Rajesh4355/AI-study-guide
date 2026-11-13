import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyDeckRefinement,
  computeSessionStats,
  DEMO_STUDY_SESSION,
  getActiveQuizQuestions,
  resetFullQuiz,
  shouldAcceptAsyncResponse,
  startWrongAnswerRetest,
} from './studySession';

test('computes flashcard mastery and quiz accuracy accurately', () => {
  const session = {
    ...DEMO_STUDY_SESSION,
    cardStatuses: {
      'demo-c1': 'mastered' as const,
      'demo-c2': 'review' as const,
    },
    quizAnswers: {
      'demo-q1': 2, // right
      'demo-q2': 0, // wrong (correct is 1)
    },
  };

  const stats = computeSessionStats(session);
  assert.equal(stats.totalCards, 5);
  assert.equal(stats.masteredCount, 1);
  assert.equal(stats.reviewCount, 1);
  assert.equal(stats.unseenCount, 3);
  assert.equal(stats.answeredCount, 2);
  assert.equal(stats.correctCount, 1);
  assert.deepEqual(stats.wrongQuestionIds, ['demo-q2']);
  assert.equal(stats.accuracyPercent, 50);
});

test('startWrongAnswerRetest clears only wrong answers and filters active quiz to missed items', () => {
  const answered = {
    ...DEMO_STUDY_SESSION,
    quizAnswers: {
      'demo-q1': 2, // right
      'demo-q2': 0, // wrong
      'demo-q3': 1, // right
      'demo-q4': 0, // wrong
    },
  };

  const retest = startWrongAnswerRetest(answered);
  assert.equal(retest.retestRound, 1);
  assert.deepEqual(retest.retestQuestionIds, ['demo-q2', 'demo-q4']);
  assert.equal(retest.quizAnswers['demo-q1'], 2);
  assert.equal(retest.quizAnswers['demo-q3'], 1);
  assert.equal(retest.quizAnswers['demo-q2'], undefined);
  assert.equal(retest.quizAnswers['demo-q4'], undefined);

  const active = getActiveQuizQuestions(retest);
  assert.deepEqual(
    active.map((q) => q.id),
    ['demo-q2', 'demo-q4']
  );

  const fullReset = resetFullQuiz(retest);
  assert.equal(fullReset.retestRound, 0);
  assert.deepEqual(fullReset.retestQuestionIds, []);
  assert.deepEqual(fullReset.quizAnswers, {});
});

test('applyDeckRefinement preserves progress for unchanged IDs and drops removed items', () => {
  const session = {
    ...DEMO_STUDY_SESSION,
    cardStatuses: {
      'demo-c1': 'mastered' as const,
      'demo-c5': 'review' as const,
    },
    quizAnswers: {
      'demo-q1': 2,
      'demo-q2': 1,
    },
  };

  const refinedDeck = {
    ...DEMO_STUDY_SESSION.deck,
    flashcards: [
      DEMO_STUDY_SESSION.deck.flashcards[0], // demo-c1 kept
      { id: 'demo-c-new', front: 'New?', back: 'Yes.', conceptTag: 'New' },
    ],
    quiz: [DEMO_STUDY_SESSION.deck.quiz[0]], // only demo-q1 kept
  };

  const updated = applyDeckRefinement(session, refinedDeck);
  assert.equal(updated.cardStatuses['demo-c1'], 'mastered');
  assert.equal(updated.cardStatuses['demo-c5'], undefined);
  assert.equal(updated.quizAnswers['demo-q1'], 2);
  assert.equal(updated.quizAnswers['demo-q2'], undefined);
});

test('shouldAcceptAsyncResponse rejects stale or aborted responses', () => {
  assert.equal(shouldAcceptAsyncResponse(3, 3, false), true);
  assert.equal(shouldAcceptAsyncResponse(3, 2, false), false);
  assert.equal(shouldAcceptAsyncResponse(3, 3, true), false);
});
