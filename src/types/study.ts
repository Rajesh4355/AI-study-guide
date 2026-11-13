export type DifficultyLevel = 'introductory' | 'intermediate' | 'advanced';

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  hint?: string;
  conceptTag: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  conceptTag: string;
}

export interface StudyDeckData {
  title: string;
  subject: string;
  summary: string;
  keyConcepts: string[];
  flashcards: Flashcard[];
  quiz: QuizQuestion[];
}

export type CardStatus = 'unseen' | 'review' | 'mastered';

export interface StudySession {
  id: string;
  sourceText: string;
  difficulty: DifficultyLevel;
  createdAt: string;
  updatedAt: string;
  deck: StudyDeckData;
  cardStatuses: Record<string, CardStatus>;
  quizAnswers: Record<string, number>;
  retestQuestionIds: string[];
  retestRound: number;
}

export type StudyErrorCode =
  | 'EMPTY_RESPONSE'
  | 'MALFORMED_JSON'
  | 'INVALID_SCHEMA'
  | 'NO_VALID_ITEMS'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'RATE_LIMITED'
  | 'SERVER_ERROR'
  | 'VALIDATION_ERROR';

export interface StudyParseSuccess {
  ok: true;
  data: StudyDeckData;
  warnings: string[];
}

export interface StudyParseFailure {
  ok: false;
  errorCode: StudyErrorCode;
  message: string;
  rawPreview?: string;
}

export type StudyParseResult = StudyParseSuccess | StudyParseFailure;

export interface StreamingProgressSnapshot {
  title?: string;
  subject?: string;
  flashcardCount: number;
  quizCount: number;
}
