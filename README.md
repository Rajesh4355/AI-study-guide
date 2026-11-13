# StudyDeck — Structured AI Study Assistant

StudyDeck converts free-form lecture notes, textbook excerpts, or topic prompts into validated, interactive flashcards and multiple-choice quizzes with wrong-answer re-testing, in-place deck refinement, and local session persistence.

## Setup & Running Locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Set your Gemini API key in `.env` (see `.env.example`):
   ```bash
   GEMINI_API_KEY="your_api_key_here"
   ```
3. Start the full-stack development server (Express API + Vite middleware on port 3000):
   ```bash
   npm start
   ```
4. Run unit tests for the JSON parser, failure-recovery logic, and quiz/re-test state machine:
   ```bash
   npx --yes tsx --test src/utils/aiParser.test.ts src/utils/studySession.test.ts
   ```
5. Build for production:
   ```bash
   npm run build
   ```

## Architecture & Structured AI Handling

- **Backend Proxy (`server.ts`)**: Exposes `POST /api/study/generate` (Server-Sent Events streaming via `@google/genai` `generateContentStream` with `responseMimeType: "application/json"` and `responseSchema`) and `POST /api/study/refine`. The `GEMINI_API_KEY` stays strictly on the server.
- **Unpredictable Output Resilience (`src/utils/aiParser.ts`)**:
  - Extracts balanced JSON objects or arrays even if wrapped in markdown code fences or prose.
  - Strips trailing commas before closing brackets/braces.
  - Validates shape with `zod` and sanitizes individual cards and quiz items: out-of-range `correctIndex` values, duplicate/empty options, or incomplete cards are dropped with an explicit non-blocking recovery banner rather than crashing the UI, and `correctIndex` is remapped when empty options are stripped.
  - Surfaces clear, actionable error panels (`EMPTY_RESPONSE`, `MALFORMED_JSON`, `INVALID_SCHEMA`, `NO_VALID_ITEMS`, `TIMEOUT`, `RATE_LIMITED`, `NETWORK_ERROR`) with a Retry action and inspectable raw output snippet.
- **Race-Condition & Timeout Protection (`src/App.tsx`, `src/utils/studyApi.ts`, `src/utils/studySession.ts`)**:
  - Uses `AbortController` timeouts (45s) plus monotonically incrementing request IDs (`shouldAcceptAsyncResponse`) so cancelled or stale responses can never overwrite a newer request.
- **Interactive Study Modes**:
  - **Flashcards (`src/components/FlashcardStage.tsx`)**: 3D flip cards, optional hints, mastery filtering (`All`, `Needs Review`, `Unseen`, `Mastered`), shuffle, and keyboard shortcuts (`Space` to flip, `ArrowLeft`/`ArrowRight` to step, `1`/`2` to grade when flipped).
  - **Quiz & Re-test (`src/components/QuizStage.tsx`)**: Immediate answer feedback + explanation, `1–4` keyboard selection, round score summary, and one-click **Re-test Wrong Answers** filtering.
  - **Refinement & Persistence (`src/components/DeckRefineBar.tsx`, `src/utils/storage.ts`)**: Follow-up refinement prompts update the deck while preserving progress on unchanged IDs, persisted to `localStorage`.

## AI-Usage Note

- AI coding assistance was used to scaffold TypeScript modules, Tailwind CSS styling, Express SSE wiring, and `node:test` unit tests. All schema validation rules, error-handling paths, and UI state flows were reviewed and verified with unit tests and headless Chromium checks.

## Known Limitations

- Sessions are persisted in browser `localStorage`, so clearing site data or switching browsers does not sync decks across devices.
- Real AI generation requires a valid `GEMINI_API_KEY` configured in the server environment (a pre-loaded sample deck is included so the study tools can still be explored without a key).
- When streaming very large inputs, the live progress counter tracks partially received JSON keys until the complete JSON payload validates at stream completion.

## Time Spent

- ~3.5 hours total (architecture & resilient JSON parser + unit tests, Express + Gemini SSE backend, responsive React study UI + dark mode, and browser verification).
