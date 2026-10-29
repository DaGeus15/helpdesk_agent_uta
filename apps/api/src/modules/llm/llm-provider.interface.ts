import type { z } from 'zod';

export interface LlmUsage {
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
}

export interface LlmChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface StructuredRequest<T> {
  systemInstruction: string;
  messages: LlmChatMessage[]; // historial ya construido, el último es el turno actual
  schema: z.ZodType<T>; // validación final
  jsonSchema: Record<string, unknown>; // esquema para el modo JSON del proveedor
  temperature?: number;
}

export interface LlmProvider {
  readonly name: string;
  generateStructured<T>(
    req: StructuredRequest<T>,
  ): Promise<{ data: T; usage: LlmUsage }>;
  generateText(
    systemInstruction: string,
    prompt: string,
  ): Promise<{ text: string; usage: LlmUsage }>;
  transcribeAudio(
    audio: Buffer,
    mimeType: string,
  ): Promise<{ text: string; usage: LlmUsage }>;
}

export const LLM_PROVIDER = Symbol('LLM_PROVIDER');

export class LlmOutputError extends Error {
  readonly cause?: unknown;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'LlmOutputError';
    this.cause = options?.cause;
  }
}
