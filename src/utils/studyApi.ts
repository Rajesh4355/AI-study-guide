import type {
  DifficultyLevel,
  StreamingProgressSnapshot,
  StudyDeckData,
  StudyErrorCode,
} from '../types/study';
import { extractStreamingProgress, parseAndValidateStudyDeck } from './aiParser';

export interface GenerateDeckParams {
  notes: string;
  difficulty: DifficultyLevel;
  cardCount: number;
  quizCount: number;
  signal: AbortSignal;
  onProgress?: (snapshot: StreamingProgressSnapshot) => void;
}

export interface ApiDeckSuccess {
  ok: true;
  deck: StudyDeckData;
  warnings: string[];
}

export interface ApiDeckFailure {
  ok: false;
  errorCode: StudyErrorCode;
  message: string;
  rawPreview?: string;
}

export type ApiDeckResult = ApiDeckSuccess | ApiDeckFailure;

const REQUEST_TIMEOUT_MS = 60000;

function withTimeoutSignal(externalSignal: AbortSignal): {
  signal: AbortSignal;
  cleanup: () => void;
  didTimeout: () => boolean;
} {
  const controller = new AbortController();
  let timedOut = false;

  const onExternalAbort = () => {
    controller.abort(externalSignal.reason);
  };

  if (externalSignal.aborted) {
    controller.abort(externalSignal.reason);
  } else {
    externalSignal.addEventListener('abort', onExternalAbort, { once: true });
  }

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort(new Error('TIMEOUT'));
  }, REQUEST_TIMEOUT_MS);

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      externalSignal.removeEventListener('abort', onExternalAbort);
    },
    didTimeout: () => timedOut,
  };
}

export async function generateStudyDeck(params: GenerateDeckParams): Promise<ApiDeckResult> {
  const { signal, cleanup, didTimeout } = withTimeoutSignal(params.signal);

  try {
    const response = await fetch('/api/study/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream, application/json',
      },
      body: JSON.stringify({
        notes: params.notes,
        difficulty: params.difficulty,
        cardCount: params.cardCount,
        quizCount: params.quizCount,
        stream: true,
      }),
      signal,
    });

    const contentType = response.headers.get('content-type') ?? '';

    if (!response.ok) {
      let errPayload: { errorCode?: StudyErrorCode; message?: string } = {};
      try {
        errPayload = await response.json();
      } catch {
        // Fallback if server returned non-JSON error body
      }
      return {
        ok: false,
        errorCode:
          errPayload.errorCode ??
          (response.status === 429 ? 'RATE_LIMITED' : 'SERVER_ERROR'),
        message:
          errPayload.message ??
          `Request failed with status ${response.status}. Please retry.`,
      };
    }

    if (contentType.includes('text/event-stream') && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedRaw = '';
      let finalRawText: string | null = null;
      let streamError: ApiDeckFailure | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');

        const frames = buffer.split('\n\n');
        buffer = frames.pop() ?? '';

        for (const frame of frames) {
          const lines = frame.split('\n');
          let eventName = 'message';
          const dataLines: string[] = [];

          for (const line of lines) {
            if (line.startsWith('event:')) {
              eventName = line.slice(6).trim();
            } else if (line.startsWith('data:')) {
              dataLines.push(line.slice(5).trim());
            }
          }

          const rawData = dataLines.join('\n');
          if (!rawData) continue;

          try {
            const parsed = JSON.parse(rawData) as Record<string, unknown>;
            if (eventName === 'chunk' && typeof parsed.text === 'string') {
              accumulatedRaw += parsed.text;
              params.onProgress?.(extractStreamingProgress(accumulatedRaw));
            } else if (eventName === 'done') {
              finalRawText =
                typeof parsed.rawText === 'string' ? parsed.rawText : accumulatedRaw;
            } else if (eventName === 'error') {
              streamError = {
                ok: false,
                errorCode: (parsed.errorCode as StudyErrorCode) ?? 'SERVER_ERROR',
                message:
                  typeof parsed.message === 'string'
                    ? parsed.message
                    : 'Stream error occurred while generating study deck.',
              };
            }
          } catch {
            // Ignore malformed SSE frame metadata
          }
        }
      }

      if (streamError) {
        return streamError;
      }

      const rawToParse = finalRawText ?? accumulatedRaw;
      const validated = parseAndValidateStudyDeck(rawToParse);
      if (!validated.ok) {
        return validated;
      }
      return {
        ok: true,
        deck: validated.data,
        warnings: validated.warnings,
      };
    }

    // Standard JSON fallback path (also handles mocked JSON responses safely)
    const rawBody = await response.text();
    let rawModelText = rawBody;
    try {
      const jsonWrapper = JSON.parse(rawBody) as { rawText?: unknown };
      if (typeof jsonWrapper.rawText === 'string') {
        rawModelText = jsonWrapper.rawText;
      }
    } catch {
      // Leave rawBody as-is so parseAndValidateStudyDeck reports MALFORMED_JSON cleanly
    }

    const validated = parseAndValidateStudyDeck(rawModelText);
    if (!validated.ok) {
      return validated;
    }
    return {
      ok: true,
      deck: validated.data,
      warnings: validated.warnings,
    };
  } catch (err) {
    if (didTimeout()) {
      return {
        ok: false,
        errorCode: 'TIMEOUT',
        message: 'The request took too long to respond. Please retry or shorten your notes.',
      };
    }
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err;
    }
    if (params.signal.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    return {
      ok: false,
      errorCode: 'NETWORK_ERROR',
      message: 'Network connection failed before receiving a response. Check your connection and retry.',
    };
  } finally {
    cleanup();
  }
}

export async function refineStudyDeck(params: {
  currentDeck: StudyDeckData;
  sourceText: string;
  instruction: string;
  signal: AbortSignal;
}): Promise<ApiDeckResult> {
  const { signal, cleanup, didTimeout } = withTimeoutSignal(params.signal);

  try {
    const response = await fetch('/api/study/refine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentDeck: params.currentDeck,
        sourceText: params.sourceText,
        instruction: params.instruction,
      }),
      signal,
    });

    const bodyText = await response.text();
    let payload: { rawText?: unknown; errorCode?: StudyErrorCode; message?: string } = {};
    try {
      payload = JSON.parse(bodyText);
    } catch {
      return {
        ok: false,
        errorCode: 'MALFORMED_JSON',
        message: 'Received malformed JSON from the refinement endpoint.',
        rawPreview: bodyText.slice(0, 240),
      };
    }

    if (!response.ok) {
      return {
        ok: false,
        errorCode: payload.errorCode ?? 'SERVER_ERROR',
        message: payload.message ?? 'Could not refine the deck right now. Please retry.',
      };
    }

    const rawText = typeof payload.rawText === 'string' ? payload.rawText : bodyText;
    const validated = parseAndValidateStudyDeck(rawText);
    if (!validated.ok) {
      return validated;
    }

    return {
      ok: true,
      deck: validated.data,
      warnings: validated.warnings,
    };
  } catch (err) {
    if (didTimeout()) {
      return {
        ok: false,
        errorCode: 'TIMEOUT',
        message: 'Refinement timed out. Your existing study deck is unchanged.',
      };
    }
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err;
    }
    if (params.signal.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    return {
      ok: false,
      errorCode: 'NETWORK_ERROR',
      message: 'Network error during refinement. Your existing study deck is unchanged.',
    };
  } finally {
    cleanup();
  }
}
