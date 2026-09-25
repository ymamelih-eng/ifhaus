import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';

// History entries are provider-neutral: { role: 'user' | 'assistant', text }.

const PROVIDERS = ['anthropic', 'gemini'];

export function isAnthropicConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function isGeminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

export function activeProvider() {
  const p = (process.env.AI_PROVIDER || 'anthropic').toLowerCase();
  return PROVIDERS.includes(p) ? p : 'anthropic';
}

export function fallbackProvider() {
  const p = (process.env.AI_FALLBACK_PROVIDER || '').toLowerCase();
  return PROVIDERS.includes(p) && p !== activeProvider() ? p : null;
}

function isConfigured(provider) {
  return provider === 'anthropic' ? isAnthropicConfigured() : isGeminiConfigured();
}

let anthropicClient;
function getAnthropic() {
  anthropicClient ??= new Anthropic({ timeout: 30_000, maxRetries: 1 });
  return anthropicClient;
}

let geminiClient;
function getGemini() {
  geminiClient ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return geminiClient;
}

async function callAnthropic({ system, history, maxTokens, classifier }) {
  const response = await getAnthropic().messages.create({
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5',
    max_tokens: maxTokens,
    system,
    // Short DM replies and a one-word classifier do not need deep reasoning.
    ...(classifier ? { thinking: { type: 'disabled' } } : { output_config: { effort: 'low' } }),
    messages: history.map(m => ({ role: m.role, content: m.text }))
  });
  if (response.stop_reason === 'refusal') throw new Error('Anthropic refused the request');
  return response.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('')
    .trim();
}

async function callGemini({ system, history, maxTokens }) {
  const response = await getGemini().models.generateContent({
    model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
    contents: history.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.text }]
    })),
    config: {
      systemInstruction: system,
      temperature: 0.25,
      maxOutputTokens: maxTokens
    }
  });
  return (response.text || '').trim();
}

function describeError(err) {
  // Only status and message; never the request config or headers.
  const status = err?.status ? `${err.status} ` : '';
  return `${status}${err?.name || 'Error'}: ${String(err?.message || '').slice(0, 200)}`;
}

/**
 * Runs the request on the active provider and, if configured, falls back to
 * the other one when the active provider is unavailable or fails.
 * @returns {Promise<{ text: string, provider: string }>}
 */
export async function generate({ system, history, maxTokens = 1024, classifier = false }) {
  const chain = [activeProvider(), fallbackProvider()].filter(Boolean);
  let lastError;
  for (const provider of chain) {
    if (!isConfigured(provider)) {
      lastError = new Error(`${provider} not configured`);
      continue;
    }
    try {
      const call = provider === 'anthropic' ? callAnthropic : callGemini;
      console.log(`[ai] ${classifier ? 'classify' : 'reply'} via ${provider}`);
      const text = await call({ system, history, maxTokens, classifier });
      if (!text) throw new Error('empty response');
      return { text, provider };
    } catch (err) {
      lastError = err;
      console.error(`[ai] ${provider} failed: ${describeError(err)}`);
    }
  }
  throw lastError || new Error('No AI provider available');
}
