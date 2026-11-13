import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const MODEL_NAME = 'gemini-4-hydrogen';

const studyDeckSchema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: 'Concise, descriptive title for this study deck (4-8 words).',
    },
    subject: {
      type: Type.STRING,
      description: 'Academic or practical subject area (1-3 words).',
    },
    summary: {
      type: Type.STRING,
      description: '2-sentence crisp synthesis of the material.',
    },
    keyConcepts: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: '3 to 6 core concepts or terms covered.',
    },
    flashcards: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          front: { type: Type.STRING, description: 'Clear question, term, or prompt.' },
          back: { type: Type.STRING, description: 'Accurate, concise explanation or answer.' },
          hint: { type: Type.STRING, description: 'Optional short memory cue without giving away the answer.' },
          conceptTag: { type: Type.STRING, description: 'Short 1-3 word concept label.' },
        },
        required: ['id', 'front', 'back', 'conceptTag'],
      },
    },
    quiz: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          question: { type: Type.STRING, description: 'Clear multiple-choice question testing understanding.' },
          options: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Exactly 4 distinct plausible answer choices.',
          },
          correctIndex: {
            type: Type.INTEGER,
            description: '0-based index (0 to 3) pointing to the single correct option.',
          },
          explanation: {
            type: Type.STRING,
            description: 'Brief explanation of why the correct option is right and why common distractors are wrong.',
          },
          conceptTag: { type: Type.STRING, description: 'Short 1-3 word concept label.' },
        },
        required: ['id', 'question', 'options', 'correctIndex', 'explanation', 'conceptTag'],
      },
    },
  },
  required: ['title', 'subject', 'summary', 'keyConcepts', 'flashcards', 'quiz'],
};

function createAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('MISSING_API_KEY');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function classifyGeminiError(err: unknown): {
  status: number;
  errorCode: string;
  message: string;
} {
  console.error('[StudyDeck API error]', err);
  const rawMessage = err instanceof Error ? err.message : String(err);

  if (rawMessage === 'MISSING_API_KEY') {
    return {
      status: 500,
      errorCode: 'SERVER_ERROR',
      message: 'Server configuration error: GEMINI_API_KEY is not set.',
    };
  }

  if (rawMessage.includes('429') || rawMessage.includes('RESOURCE_EXHAUSTED')) {
    return {
      status: 429,
      errorCode: 'RATE_LIMITED',
      message: 'The AI service is temporarily rate-limited. Please wait a moment and retry.',
    };
  }

  if (
    rawMessage.includes('403') ||
    rawMessage.includes('PERMISSION_DENIED') ||
    rawMessage.includes('API_KEY_INVALID')
  ) {
    return {
      status: 403,
      errorCode: 'SERVER_ERROR',
      message: 'Gemini API authentication failed. Please verify the configured API key.',
    };
  }

  if (rawMessage.includes('abort') || rawMessage.includes('TIMEOUT')) {
    return {
      status: 504,
      errorCode: 'TIMEOUT',
      message: 'The AI request timed out before finishing. Please retry.',
    };
  }

  return {
    status: 502,
    errorCode: 'SERVER_ERROR',
    message: 'Unable to generate study materials from the AI service right now. Please retry.',
  };
}

function writeSseEvent(res: Response, event: string, payload: unknown): void {
  if (res.writableEnded) return;
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

async function runWithRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isTransient =
        msg.includes('500') ||
        msg.includes('502') ||
        msg.includes('503') ||
        msg.includes('504') ||
        msg.includes('429') ||
        msg.includes('RESOURCE_EXHAUSTED') ||
        msg.includes('UNAVAILABLE') ||
        msg.includes('INTERNAL') ||
        msg.includes('fetch failed') ||
        msg.includes('ECONNRESET') ||
        msg.includes('ETIMEDOUT');
      if (!isTransient || attempt === maxAttempts) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }
  throw lastError;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.post('/api/study/generate', async (req: Request, res: Response) => {
    const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim() : '';
    const difficulty =
      req.body?.difficulty === 'introductory' ||
      req.body?.difficulty === 'advanced' ||
      req.body?.difficulty === 'intermediate'
        ? req.body.difficulty
        : 'intermediate';
    const cardCount = Math.min(Math.max(Number(req.body?.cardCount) || 6, 3), 12);
    const quizCount = Math.min(Math.max(Number(req.body?.quizCount) || 5, 3), 10);
    const wantsStream = req.body?.stream !== false;

    if (notes.length < 10) {
      res.status(400).json({
        errorCode: 'VALIDATION_ERROR',
        message: 'Please enter at least 10 characters of study notes or a clear topic.',
      });
      return;
    }

    if (notes.length > 20000) {
      res.status(400).json({
        errorCode: 'VALIDATION_ERROR',
        message: 'Notes exceed the 20,000-character limit. Please shorten or split them.',
      });
      return;
    }

    const systemInstruction = [
      'You are an expert curriculum designer creating structured study tools.',
      'Return ONLY valid JSON matching the requested schema.',
      `Generate ${cardCount} high-signal flashcards and ${quizCount} multiple-choice quiz questions at a ${difficulty} level.`,
      'Each quiz question must have exactly 4 distinct options and a valid 0-based correctIndex (0, 1, 2, or 3).',
      'Make flashcards concise and testable (active recall), avoiding trivial yes/no fronts.',
      'Assign unique string IDs like "card-1", "card-2" and "q-1", "q-2".',
    ].join(' ');

    const prompt = `Study material or topic:\n"""\n${notes}\n"""`;

    if (!wantsStream) {
      try {
        const ai = createAiClient();
        const response = await runWithRetry(() =>
          ai.models.generateContent({
            model: MODEL_NAME,
            contents: prompt,
            config: {
              systemInstruction,
              responseMimeType: 'application/json',
              responseSchema: studyDeckSchema,
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            },
          })
        );

        res.json({ rawText: response.text ?? '' });
      } catch (err) {
        const classified = classifyGeminiError(err);
        res.status(classified.status).json({
          errorCode: classified.errorCode,
          message: classified.message,
        });
      }
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    res.write(': connected\n\n');

    let clientClosed = false;
    res.on('close', () => {
      if (!res.writableEnded) {
        clientClosed = true;
      }
    });

    try {
      const ai = createAiClient();
      const stream = await runWithRetry(() =>
        ai.models.generateContentStream({
          model: MODEL_NAME,
          contents: prompt,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: studyDeckSchema,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        })
      );

      let accumulated = '';
      for await (const chunk of stream) {
        if (clientClosed) break;
        const delta = chunk.text ?? '';
        if (delta) {
          accumulated += delta;
          writeSseEvent(res, 'chunk', { text: delta });
        }
      }

      if (!clientClosed && !res.writableEnded) {
        writeSseEvent(res, 'done', { rawText: accumulated });
        res.end();
      }
    } catch (err) {
      if (!clientClosed && !res.writableEnded) {
        const classified = classifyGeminiError(err);
        writeSseEvent(res, 'error', {
          errorCode: classified.errorCode,
          message: classified.message,
        });
        res.end();
      }
    }
  });

  app.post('/api/study/refine', async (req: Request, res: Response) => {
    const instruction =
      typeof req.body?.instruction === 'string' ? req.body.instruction.trim() : '';
    const currentDeck = req.body?.currentDeck;
    const sourceText =
      typeof req.body?.sourceText === 'string' ? req.body.sourceText.slice(0, 8000) : '';

    if (instruction.length < 3) {
      res.status(400).json({
        errorCode: 'VALIDATION_ERROR',
        message: 'Please enter a refinement instruction (e.g., "Make quiz questions harder").',
      });
      return;
    }

    if (!currentDeck || typeof currentDeck !== 'object') {
      res.status(400).json({
        errorCode: 'VALIDATION_ERROR',
        message: 'Missing active study deck to refine.',
      });
      return;
    }

    const systemInstruction = [
      'You are refining an existing structured study deck based on a learner instruction.',
      'Return ONLY valid JSON matching the schema.',
      'Preserve unchanged item IDs so the learner keeps their study progress, and assign fresh unique IDs for newly added items.',
      'Ensure every quiz question has 4 distinct options and a valid 0-based correctIndex (0-3).',
    ].join(' ');

    const prompt = [
      `Refinement instruction: "${instruction}"`,
      sourceText ? `Original notes context:\n${sourceText}` : '',
      `Current study deck JSON:\n${JSON.stringify(currentDeck)}`,
    ]
      .filter(Boolean)
      .join('\n\n');

    try {
      const ai = createAiClient();
      const response = await runWithRetry(() =>
        ai.models.generateContent({
          model: MODEL_NAME,
          contents: prompt,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: studyDeckSchema,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        })
      );

      res.json({ rawText: response.text ?? '' });
    } catch (err) {
      const classified = classifyGeminiError(err);
      res.status(classified.status).json({
        errorCode: classified.errorCode,
        message: classified.message,
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`StudyDeck server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start StudyDeck server:', err);
  process.exit(1);
});
