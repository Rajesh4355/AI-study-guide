import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractJsonCandidate,
  extractStreamingProgress,
  parseAndValidateStudyDeck,
} from './aiParser';

test('parses valid structured JSON deck', () => {
  const raw = JSON.stringify({
    title: 'HTTP Basics',
    subject: 'Networking',
    summary: 'Core HTTP request-response mechanics.',
    keyConcepts: ['Methods', 'Status Codes'],
    flashcards: [
      { id: 'c1', front: 'What is HTTP 404?', back: 'Not Found', conceptTag: 'Status' },
    ],
    quiz: [
      {
        id: 'q1',
        question: 'Which HTTP method is idempotent?',
        options: ['POST', 'GET', 'CONNECT', 'PATCH'],
        correctIndex: 1,
        explanation: 'GET does not mutate server state.',
        conceptTag: 'Methods',
      },
    ],
  });

  const result = parseAndValidateStudyDeck(raw);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.title, 'HTTP Basics');
    assert.equal(result.data.flashcards.length, 1);
    assert.equal(result.data.quiz.length, 1);
    assert.equal(result.warnings.length, 0);
  }
});

test('extracts JSON wrapped in markdown fences and trailing prose, and strips trailing commas', () => {
  const raw = `Sure! Here is your deck:
\`\`\`json
{
  "title": "TCP Handshake",
  "subject": "Systems",
  "flashcards": [
    { "front": "Step 1?", "back": "SYN", },
  ],
  "quiz": [],
}
\`\`\`
Let me know if you want more!`;

  const candidate = extractJsonCandidate(raw);
  assert.ok(candidate?.startsWith('{'));

  const result = parseAndValidateStudyDeck(raw);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.flashcards[0].back, 'SYN');
  }
});

test('handles empty response cleanly without throwing', () => {
  const result = parseAndValidateStudyDeck('   \n  ');
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.errorCode, 'EMPTY_RESPONSE');
  }
});

test('handles malformed truncated JSON cleanly', () => {
  const result = parseAndValidateStudyDeck('{"title": "Broken", "flashcards": [{"front": "A"');
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.errorCode, 'MALFORMED_JSON');
  }
});

test('handles wrong root shape (array instead of object)', () => {
  const result = parseAndValidateStudyDeck('[{"front": "Q", "back": "A"}]');
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.errorCode, 'INVALID_SCHEMA');
  }
});

test('salvages valid items and emits warnings when individual cards or quiz items are invalid', () => {
  const raw = JSON.stringify({
    title: 'Mixed Quality Deck',
    flashcards: [
      { front: 'Valid Front', back: 'Valid Back' },
      { front: 'Missing Back', back: '' },
    ],
    quiz: [
      {
        question: 'Out of bounds index',
        options: ['A', 'B', 'C', 'D'],
        correctIndex: 9,
      },
      {
        question: 'Valid Question',
        options: ['Alpha', '', 'Alpha', 'Beta'],
        correctIndex: 3,
      },
    ],
  });

  const result = parseAndValidateStudyDeck(raw);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.flashcards.length, 1);
    assert.equal(result.data.quiz.length, 1);
    // 'Alpha' deduplicated, empty skipped, so 'Beta' moved from orig index 3 -> remapped index 1
    assert.deepEqual(result.data.quiz[0].options, ['Alpha', 'Beta']);
    assert.equal(result.data.quiz[0].correctIndex, 1);
    assert.equal(result.warnings.length, 2);
  }
});

test('fails with NO_VALID_ITEMS if all items are unusable', () => {
  const raw = JSON.stringify({
    title: 'Empty Shell',
    flashcards: [{ front: '', back: 'No prompt' }],
    quiz: [{ question: 'Only 1 opt', options: ['Solo'], correctIndex: 0 }],
  });

  const result = parseAndValidateStudyDeck(raw);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.errorCode, 'NO_VALID_ITEMS');
  }
});

test('extracts partial streaming progress before JSON closes', () => {
  const partial =
    '{"title":"Cellular Respiration","subject":"Biology","flashcards":[{"front":"Q1","back":"A1"},{"front":"Q2"';
  const progress = extractStreamingProgress(partial);
  assert.equal(progress.title, 'Cellular Respiration');
  assert.equal(progress.subject, 'Biology');
  assert.equal(progress.flashcardCount, 2);
  assert.equal(progress.quizCount, 0);
});
