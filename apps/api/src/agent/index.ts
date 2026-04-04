import { streamText, stepCountIs } from 'ai';
import type { CoreMessage } from 'ai';
import { classifyIntent, selectModel } from './classifier';
import { assembleContext, loadSystemPrompt, type UserContext } from './context';
import { applyWindow } from './window';
import { getBalanceTool } from '../tools/get-balance';

// Load system prompt once at module init
let systemPrompt: string;
try {
  systemPrompt = loadSystemPrompt();
} catch {
  systemPrompt = 'You are Genie, an AI personal accountant.';
}

export interface ChatRequest {
  messages: CoreMessage[];
  userId?: string;
}

/**
 * runAgent — Main agent orchestrator.
 * 1. Classifies intent via DeepSeek V3 (D-01)
 * 2. Selects model based on intent (D-03)
 * 3. Assembles three-layer context (AGEN-05)
 * 4. Applies sliding window (AGEN-06, D-16)
 * 5. Streams response with tool calling (AGEN-04, D-05, D-12)
 */
export async function runAgent(request: ChatRequest) {
  const { messages } = request;

  // Extract latest user message for classification
  const lastMessage = messages[messages.length - 1];
  const userMessage =
    typeof lastMessage?.content === 'string' ? lastMessage.content : '';

  // Step 1: Classify intent (D-01) — uses DeepSeek V3 via generateText
  const intent = await classifyIntent(userMessage);
  console.log(`[agent] classified intent: ${intent}`);

  // Step 2: Select model (D-03 — single model per request)
  const model = selectModel(intent);
  console.log(
    `[agent] selected model: ${intent === 'action' ? 'DeepSeek V3' : 'GLM-5'}`,
  );

  // Step 3: Assemble three-layer context (AGEN-05)
  // Phase 1 uses stub user context — real context comes from Phase 2 (0G KV)
  const stubUserContext: UserContext = {
    walletAddress: '0x0000000000000000000000000000000000000000',
    displayName: 'User',
    autoApproveUsd: 25,
  };

  // Separate history from the current message
  const history = messages.slice(0, -1);
  const ctx = assembleContext(systemPrompt, stubUserContext, history, userMessage);

  // Step 4: Apply sliding window (AGEN-06)
  const windowedMessages = applyWindow(ctx.messages, 40);
  console.log(
    `[agent] context assembled: ${windowedMessages.length} messages (windowed from ${ctx.messages.length})`,
  );

  // Step 5: Stream response with tool calling (AGEN-04, D-05, D-12, D-13)
  // Use stopWhen: stepCountIs(5) per AI SDK v6 canonical API (replaces deprecated maxSteps)
  const result = streamText({
    model,
    system: ctx.system,
    messages: windowedMessages,
    tools: { get_balance: getBalanceTool },
    stopWhen: stepCountIs(5),
    onStepFinish: ({ toolResults }) => {
      if (toolResults && toolResults.length > 0) {
        console.log('[agent] tool results:', JSON.stringify(toolResults, null, 2));
      }
    },
    onError: ({ error }) => {
      console.error('[agent] stream error:', error);
    },
  });

  return result;
}
