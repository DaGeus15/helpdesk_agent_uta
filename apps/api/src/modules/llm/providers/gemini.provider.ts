import { Logger } from '@nestjs/common';
import { ApiError, GoogleGenAI, type Content } from '@google/genai';
import {
  LlmOutputError,
  type LlmChatMessage,
  type LlmProvider,
  type LlmUsage,
  type StructuredRequest,
} from '../llm-provider.interface';

const CALL_TIMEOUT_MS = 25_000;
const DEFAULT_FALLBACK_MODELS = [
  'gemini-2.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-flash-latest',
];

export class GeminiProvider implements LlmProvider {
  readonly name = 'gemini';
  private readonly logger = new Logger(GeminiProvider.name);
  private readonly ai: GoogleGenAI;
  /** Cadena de modelos: si uno agota su cuota (429) se usa el siguiente. */
  private readonly models: string[];
  private fallbackHopsTotal = 0;
  private rateLimitedTotal = 0;

  constructor(apiKey: string, models: string) {
    this.ai = new GoogleGenAI({ apiKey });
    const configured = models
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean);
    // Siempre hay respaldo, aunque GEMINI_MODEL nombre un único modelo.
    this.models = [...new Set([...configured, ...DEFAULT_FALLBACK_MODELS])];
  }

  getObservability(): { fallbacks: number; rateLimited: number } {
    return {
      fallbacks: this.fallbackHopsTotal,
      rateLimited: this.rateLimitedTotal,
    };
  }

  async generateStructured<T>(
    req: StructuredRequest<T>,
  ): Promise<{ data: T; usage: LlmUsage }> {
    const attempt = async (): Promise<{ data: T; usage: LlmUsage }> => {
      const { response, usage } = await this.call({
        contents: toContents(req.messages),
        config: {
          systemInstruction: req.systemInstruction,
          temperature: req.temperature,
          responseMimeType: 'application/json',
          responseJsonSchema: req.jsonSchema,
        },
      });

      const raw = response.text?.trim();
      if (!raw) {
        throw new LlmOutputError('Gemini returned empty structured response');
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch (cause) {
        throw new LlmOutputError(
          `Gemini returned invalid JSON: ${raw.slice(0, 200)}`,
          { cause },
        );
      }

      const validated = req.schema.safeParse(parsed);
      if (!validated.success) {
        throw new LlmOutputError(
          `Gemini JSON failed zod validation: ${validated.error.message}`,
        );
      }

      return { data: validated.data, usage };
    };

    try {
      return await attempt();
    } catch (firstError) {
      if (!(firstError instanceof LlmOutputError)) {
        throw firstError;
      }
      try {
        return await attempt();
      } catch (secondError) {
        if (secondError instanceof LlmOutputError) {
          throw secondError;
        }
        throw new LlmOutputError(
          `Gemini structured output failed after retry: ${String(secondError)}`,
          { cause: secondError },
        );
      }
    }
  }

  async generateText(
    systemInstruction: string,
    prompt: string,
  ): Promise<{ text: string; usage: LlmUsage }> {
    const { response, usage } = await this.call({
      contents: prompt,
      config: { systemInstruction },
    });

    const text = response.text?.trim() ?? '';
    return { text, usage };
  }

  async transcribeAudio(
    audio: Buffer,
    mimeType: string,
  ): Promise<{ text: string; usage: LlmUsage }> {
    const { response, usage } = await this.call({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: 'Transcribe literalmente este audio en español. Devuelve solo la transcripción.',
            },
            {
              inlineData: {
                mimeType,
                data: audio.toString('base64'),
              },
            },
          ],
        },
      ],
    });

    const text = response.text?.trim() ?? '';
    return { text, usage };
  }

  private async call(params: {
    contents: Parameters<GoogleGenAI['models']['generateContent']>[0]['contents'];
    config?: Parameters<
      GoogleGenAI['models']['generateContent']
    >[0]['config'];
  }) {
    const started = performance.now();
    const { response, model, fallbackHops } = await this.generateWithFallback({
      contents: params.contents,
      config: {
        ...params.config,
        httpOptions: {
          ...params.config?.httpOptions,
          timeout: CALL_TIMEOUT_MS,
        },
      },
    });
    const latencyMs = Math.round(performance.now() - started);

    const usage: LlmUsage = {
      tokensIn: response.usageMetadata?.promptTokenCount ?? 0,
      tokensOut: response.usageMetadata?.candidatesTokenCount ?? 0,
      latencyMs,
    };

    this.logger.log(
      JSON.stringify({
        event: 'gemini_call',
        model,
        fallbackHops,
        latencyMs,
        tokensIn: usage.tokensIn,
        tokensOut: usage.tokensOut,
      }),
    );

    return { response, usage };
  }

  private async generateWithFallback(
    params: Omit<Parameters<GoogleGenAI['models']['generateContent']>[0], 'model'>,
  ): Promise<{
    response: Awaited<ReturnType<GoogleGenAI['models']['generateContent']>>;
    model: string;
    fallbackHops: number;
  }> {
    let lastError: unknown;
    let hops = 0;
    for (const model of this.models) {
      try {
        // Sin "thinking" en la familia 2.5: el turno conversacional no lo necesita y baja la latencia.
        const config = model.startsWith('gemini-2.5')
          ? { ...params.config, thinkingConfig: { thinkingBudget: 0 } }
          : params.config;
        const response = await this.ai.models.generateContent({
          ...params,
          config,
          model,
        });
        if (hops > 0) {
          this.fallbackHopsTotal += hops;
        }
        return { response, model, fallbackHops: hops };
      } catch (error) {
        const status = error instanceof ApiError ? error.status : undefined;
        if (status === 429) {
          this.rateLimitedTotal += 1;
        }
        const retryable =
          // 429 cuota, 5xx caída y 404 modelo retirado: se prueba el siguiente.
          error instanceof ApiError && [404, 429, 500, 503].includes(error.status);
        if (!retryable) throw error;
        hops += 1;
        lastError = error;
      }
    }
    throw lastError;
  }
}

function toContents(messages: LlmChatMessage[]): Content[] {
  return messages.map((message) => ({
    role: message.role,
    parts: [{ text: message.text }],
  }));
}
