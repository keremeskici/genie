import { createOpenAI } from '@ai-sdk/openai';
import { OPENAI_API_KEY, OPENAI_MODEL } from '../config/env';

export { OPENAI_MODEL as MODEL_NAME };

// Official OpenAI API. Single fast, cost-effective model for the whole agent loop.
const openai = createOpenAI({ apiKey: OPENAI_API_KEY });

// .chat() forces /v1/chat/completions, which is the most widely compatible surface
// for tool calling via the Vercel AI SDK.
export const agentModel = openai.chat(OPENAI_MODEL);
