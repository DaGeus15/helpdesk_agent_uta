import { GoogleGenAI, type Content } from '@google/genai';
import {
  LlmOutputError,
  type LlmChatMessage,
  type LlmProvider,
  type LlmUsage,
  type StructuredRequest,
} from '../llm-provider.interface';

const CALL_TIMEOUT_MS = 25_000;

export class GeminiProvider implements LlmProvider {
  readonly name = 'gemini';
  private readonly ai: GoogleGenAI;

  constructor(
    apiKey: string,
    private readonly model: string,
  ) {
    this.ai = new GoogleGenAI({ apiKey });
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
    const response = await this.ai.models.generateContent({
      model: this.model,
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

    return { response, usage };
  }
}

function toContents(messages: LlmChatMessage[]): Content[] {
  return messages.map((message) => ({
    role: message.role,
    parts: [{ text: message.text }],
  }));
}
