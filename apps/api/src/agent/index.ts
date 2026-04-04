import { streamText, stepCountIs } from 'ai';
import type { CoreMessage } from 'ai';
import { classifyIntent, selectModel } from './classifier';
import { assembleContext, loadSystemPrompt, type UserContext } from './context';
import { applyWindow } from './window';
import { createGetBalanceTool } from '../tools/get-balance';
import { createResolveContactTool } from '../tools/resolve-contact';
import { createSendUsdcTool } from '../tools/send-usdc';
import { createUpdateMemoryTool } from '../tools/update-memory';
import { DEFAULT_MEMORY } from '../kv/types';
import { PLANNING_MODEL, ACTION_MODEL } from './providers';

export type { UserContext };

const MAX_OUTPUT_TOKENS = parseInt(process.env.MAX_OUTPUT_TOKENS ?? '2048', 10);
const WINDOW_LIMIT = parseInt(process.env.WINDOW_LIMIT ?? '40', 10);

// Load system prompt once at module init — fail hard if missing
const systemPrompt = loadSystemPrompt();

export interface ChatRequest {
  messages: CoreMessage[];
  userId?: string;
  userContext?: UserContext;
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
    `[agent] selected model: ${intent === 'action' ? ACTION_MODEL : PLANNING_MODEL}`,
  );

  // Step 3: Assemble three-layer context (AGEN-05)
  // Use provided user context (from chat route cache) or fall back to stub
  const resolvedUserContext: UserContext = request.userContext ?? {
    walletAddress: '0x0000000000000000000000000000000000000000',
    displayName: 'User',
    autoApproveUsd: 25,
    isVerified: false,
    isHumanBacked: false,
  };

  // Create factory tools with per-request context
  // get_balance is always available (ungated — checking balance works for all users)
  const getBalanceTool = createGetBalanceTool(resolvedUserContext);

  // resolve_contact and send_usdc require userId (need DB access + verification gate)
  const resolveContactTool = request.userId
    ? createResolveContactTool(request.userId)
    : undefined;
  const sendUsdcTool = request.userId
    ? createSendUsdcTool(request.userId, resolvedUserContext)
    : undefined;

  // Create update_memory tool with current user's memory context
  // Uses factory pattern — each request gets its own tool with userId + memory snapshot
  // Only available when there is a userId (anonymous users cannot persist memory)
  const currentMemory = resolvedUserContext.memory ?? { ...DEFAULT_MEMORY, updatedAt: new Date().toISOString() };
  const updateMemoryTool = request.userId
    ? createUpdateMemoryTool(request.userId, currentMemory)
    : undefined;

  // Separate history from the current message
  const history = messages.slice(0, -1);
  const ctx = assembleContext(systemPrompt, resolvedUserContext, history, userMessage);

  // Step 4: Apply sliding window (AGEN-06)
  const windowedMessages = applyWindow(ctx.messages, WINDOW_LIMIT);
  console.log(
    `[agent] context assembled: ${windowedMessages.length} messages (windowed from ${ctx.messages.length})`,
  );

  // Step 5: Stream response with tool calling (AGEN-04, D-05, D-12, D-13)
  // Use stopWhen: stepCountIs(5) per AI SDK v6 canonical API (replaces deprecated maxSteps)
  const result = streamText({
    model,
    system: ctx.system,
    messages: windowedMessages,
    tools: {
      get_balance: getBalanceTool,
      ...(resolveContactTool ? { resolve_contact: resolveContactTool } : {}),
      ...(sendUsdcTool ? { send_usdc: sendUsdcTool } : {}),
      ...(updateMemoryTool ? { update_memory: updateMemoryTool } : {}),
    },
    maxOutputTokens: MAX_OUTPUT_TOKENS,
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
