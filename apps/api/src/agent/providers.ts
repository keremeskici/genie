import { createOpenAI } from '@ai-sdk/openai';
import { OG_COMPUTE_URL, OG_API_KEY, OG_PLANNING_MODEL, OG_ACTION_MODEL } from '../config/env';

export { OG_COMPUTE_URL, OG_PLANNING_MODEL as PLANNING_MODEL, OG_ACTION_MODEL as ACTION_MODEL };

// 0G Compute Adapter exposes an OpenAI-compatible API at /v1
const og = createOpenAI({
  baseURL: `${OG_COMPUTE_URL}/v1`,
  apiKey: OG_API_KEY,
  compatibility: 'compatible',
});

// Use .chat() to force /v1/chat/completions (not /v1/responses which 0G doesn't support)
// structuredOutputs: false prevents sending response_format the upstream rejects
export const glm5 = og.chat(OG_PLANNING_MODEL);
export const deepseekV3 = og.chat(OG_ACTION_MODEL);
