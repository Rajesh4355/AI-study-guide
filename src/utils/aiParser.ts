import { z } from 'zod';
import type {
  Flashcard,
  QuizQuestion,
  StreamingProgressSnapshot,
  StudyDeckData,
  StudyParseResult,
} from '../types/study';

const RawFlashcardSchema = z.object({
  id: z.string().optional(),
  front: z.string().optional(),
  back: z.string().optional(),
  hint: z.string().optional().nullable(),
  conceptTag: z.string().optional().nullable(),
});

const RawQuizQuestionSchema = z.object({
  id: z.string().optional(),
  question: z.string().optional(),
  options: z.array(z.unknown()).optional(),
  correctIndex: z.union([z.number(), z.string()]).optional(),
  explanation: z.string().optional().nullable(),
  conceptTag: z.string().optional().nullable(),
});

const RawStudyDeckSchema = z.object({
  title: z.string().optional(),
  subject: z.string().optional(),
  summary: z.string().optional(),
  keyConcepts: z.array(z.unknown()).optional(),
  flashcards: z.array(RawFlashcardSchema).optional(),
  quiz: z.array(RawQuizQuestionSchema).optional(),
});

/**
 * Removes trailing commas before } or ] outside of string literals so minor
 * JSON formatting mistakes from LLMs still parse cleanly.
 */
function stripTrailingCommas(input: string): string {
  let out = '';
  let inString = false;
  let escaped = false;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (inString) {
      out += ch;
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }

    if (ch === ',') {
      let j = i + 1;
      while (j < input.length && /\s/.test(input[j])) {
        j += 1;
      }
      if (input[j] === '}' || input[j] === ']') {
        continue;
      }
    }

    out += ch;
  }

  return out;
}

/**
 * Extracts the first balanced top-level JSON object from text that may include
 * markdown code fences or stray prose before/after the JSON payload.
 */
export function extractJsonCandidate(rawText: string): string | null {
  const trimmed = rawText.trim();
  if (!trimmed) return null;

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const searchSource = fenceMatch ? fenceMatch[1].trim() : trimmed;

  const firstBrace = searchSource.indexOf('{');
  const firstBracket = searchSource.indexOf('[');

  if (firstBrace === -1 && firstBracket === -1) return null;

  const openChar =
    firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)
      ? '['
      : '{';
  const closeChar = openChar === '[' ? ']' : '}';
  const startIdx = openChar === '[' ? firstBracket : firstBrace;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = startIdx; i < searchSource.length; i += 1) {
    const ch = searchSource[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
    } else if (ch === openChar) {
      depth += 1;
    } else if (ch === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return searchSource.slice(startIdx, i + 1);
      }
    }
  }

  return searchSource.slice(startIdx);
}

function cleanText(val: unknown): string {
  return typeof val === 'string' ? val.trim() : '';
}

function sanitizeFlashcards(
  rawCards: Array<z.infer<typeof RawFlashcardSchema>>,
  warnings: string[]
): Flashcard[] {
  const validCards: Flashcard[] = [];

  rawCards.forEach((raw, idx) => {
    const front = cleanText(raw.front);
    const back = cleanText(raw.back);

    if (!front || !back) {
      warnings.push(
        `Skipped flashcard #${idx + 1} because it was missing a ${!front ? 'prompt' : 'answer'}.`
      );
      return;
    }

    const hint = cleanText(raw.hint);
    const conceptTag = cleanText(raw.conceptTag) || 'Core Concept';
    const id = cleanText(raw.id) || `card-${idx + 1}`;

    validCards.push({
      id,
      front,
      back,
      hint: hint || undefined,
      conceptTag,
    });
  });

  return validCards;
}

function sanitizeQuizQuestions(
  rawQuiz: Array<z.infer<typeof RawQuizQuestionSchema>>,
  warnings: string[]
): QuizQuestion[] {
  const validQuestions: QuizQuestion[] = [];

  rawQuiz.forEach((raw, idx) => {
    const question = cleanText(raw.question);
    if (!question) {
      warnings.push(`Skipped quiz question #${idx + 1} because the prompt was empty.`);
      return;
    }

    const rawOptions = Array.isArray(raw.options) ? raw.options : [];
    const seen = new Set<string>();
    const indexMap = new Map<number, number>();
    const options: string[] = [];

    rawOptions.forEach((opt, origIdx) => {
      const cleaned = cleanText(opt);
      if (!cleaned) return;
      const key = cleaned.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      indexMap.set(origIdx, options.length);
      options.push(cleaned);
    });

    if (options.length < 2) {
      warnings.push(
        `Skipped quiz question #${idx + 1} because it had fewer than 2 distinct options.`
      );
      return;
    }

    let parsedIndex: number | null = null;
    if (typeof raw.correctIndex === 'number' && Number.isInteger(raw.correctIndex)) {
      parsedIndex = raw.correctIndex;
    } else if (typeof raw.correctIndex === 'string' && /^\d+$/.test(raw.correctIndex.trim())) {
      parsedIndex = Number.parseInt(raw.correctIndex.trim(), 10);
    }

    if (parsedIndex === null || parsedIndex < 0 || parsedIndex >= rawOptions.length) {
      warnings.push(
        `Skipped quiz question #${idx + 1} because its answer index was out of range.`
      );
      return;
    }

    const remappedIndex = indexMap.get(parsedIndex);
    if (remappedIndex === undefined) {
      warnings.push(
        `Skipped quiz question #${idx + 1} because the marked correct option was empty or duplicated.`
      );
      return;
    }

    const explanation =
      cleanText(raw.explanation) ||
      `The correct answer is "${options[remappedIndex]}".`;
    const conceptTag = cleanText(raw.conceptTag) || 'Check';
    const id = cleanText(raw.id) || `q-${idx + 1}`;

    validQuestions.push({
      id,
      question,
      options,
      correctIndex: remappedIndex,
      explanation,
      conceptTag,
    });
  });

  return validQuestions;
}

/**
 * Parses and validates unpredictable raw LLM output into a guaranteed-safe
 * StudyDeckData structure, recovering partial valid items when possible and
 * returning structured error details when unusable.
 */
export function parseAndValidateStudyDeck(rawInput: string): StudyParseResult {
  if (typeof rawInput !== 'string' || !rawInput.trim()) {
    return {
      ok: false,
      errorCode: 'EMPTY_RESPONSE',
      message: 'The AI returned an empty response. Try again or add a bit more detail to your notes.',
    };
  }

  const candidate = extractJsonCandidate(rawInput);
  if (!candidate) {
    return {
      ok: false,
      errorCode: 'MALFORMED_JSON',
      message: 'The AI response did not contain a valid JSON object.',
      rawPreview: rawInput.slice(0, 280),
    };
  }

  let parsedUnknown: unknown;
  try {
    parsedUnknown = JSON.parse(candidate);
  } catch {
    try {
      parsedUnknown = JSON.parse(stripTrailingCommas(candidate));
    } catch {
      return {
        ok: false,
        errorCode: 'MALFORMED_JSON',
        message: 'The AI returned malformed or truncated JSON that could not be parsed.',
        rawPreview: candidate.slice(0, 280),
      };
    }
  }

  if (!parsedUnknown || typeof parsedUnknown !== 'object' || Array.isArray(parsedUnknown)) {
    return {
      ok: false,
      errorCode: 'INVALID_SCHEMA',
      message: 'The AI returned an unexpected data shape instead of a study deck object.',
      rawPreview: candidate.slice(0, 280),
    };
  }

  const shapeResult = RawStudyDeckSchema.safeParse(parsedUnknown);
  if (!shapeResult.success) {
    return {
      ok: false,
      errorCode: 'INVALID_SCHEMA',
      message: 'The AI response did not match the expected study deck schema.',
      rawPreview: candidate.slice(0, 280),
    };
  }

  const raw = shapeResult.data;
  const warnings: string[] = [];

  const flashcards = sanitizeFlashcards(raw.flashcards ?? [], warnings);
  const quiz = sanitizeQuizQuestions(raw.quiz ?? [], warnings);

  if (flashcards.length === 0 && quiz.length === 0) {
    return {
      ok: false,
      errorCode: 'NO_VALID_ITEMS',
      message:
        'No usable flashcards or quiz questions could be extracted from the AI output. Please retry.',
      rawPreview: candidate.slice(0, 280),
    };
  }

  const keyConcepts = (raw.keyConcepts ?? [])
    .map(cleanText)
    .filter(Boolean)
    .slice(0, 8);

  const deck: StudyDeckData = {
    title: cleanText(raw.title) || 'Untitled Study Deck',
    subject: cleanText(raw.subject) || 'General Study',
    summary:
      cleanText(raw.summary) ||
      `Generated ${flashcards.length} flashcards and ${quiz.length} quiz questions.`,
    keyConcepts,
    flashcards,
    quiz,
  };

  return {
    ok: true,
    data: deck,
    warnings,
  };
}

/**
 * Best-effort scanner for partial streamed JSON text so the loading view can
 * report real generation progress without failing on incomplete JSON.
 */
export function extractStreamingProgress(partialText: string): StreamingProgressSnapshot {
  const titleMatch = partialText.match(/"title"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
  const subjectMatch = partialText.match(/"subject"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);

  const flashcardsSectionIdx = partialText.indexOf('"flashcards"');
  const quizSectionIdx = partialText.indexOf('"quiz"');

  let flashcardCount = 0;
  let quizCount = 0;

  if (flashcardsSectionIdx !== -1) {
    const endIdx = quizSectionIdx > flashcardsSectionIdx ? quizSectionIdx : partialText.length;
    const cardSlice = partialText.slice(flashcardsSectionIdx, endIdx);
    const frontMatches = cardSlice.match(/"front"\s*:/g);
    flashcardCount = frontMatches ? frontMatches.length : 0;
  }

  if (quizSectionIdx !== -1) {
    const quizSlice = partialText.slice(quizSectionIdx);
    const qMatches = quizSlice.match(/"question"\s*:/g);
    quizCount = qMatches ? qMatches.length : 0;
  }

  return {
    title: titleMatch?.[1],
    subject: subjectMatch?.[1],
    flashcardCount,
    quizCount,
  };
}
