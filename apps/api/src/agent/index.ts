import { streamText, stepCountIs } from 'ai';
import type { ModelMessage } from 'ai';
import { classifyIntent, selectModel } from './classifier';
import { assembleContext, loadSystemPrompt, type UserContext } from './context';
import { applyWindow } from './window';
import { createGetBalanceTool } from '../tools/get-balance';
import { createResolveContactTool } from '../tools/resolve-contact';
import { createSendUsdcTool } from '../tools/send-usdc';
import { createUpdateMemoryTool } from '../tools/update-memory';
import { createCreateDebtTool } from '../tools/create-debt';
import { createListDebtsTool } from '../tools/list-debts';
import { createGetSpendingTool } from '../tools/get-spending';
import { createAddContactTool } from '../tools/add-contact';
import { createListContactsTool } from '../tools/list-contacts';
import { createSettleCrosschainDebtTool } from '../tools/settle-crosschain-debt';
import { DEFAULT_MEMORY } from '../kv/types';
import { PLANNING_MODEL, ACTION_MODEL } from './providers';
import { MAX_OUTPUT_TOKENS, WINDOW_LIMIT } from '../config/env';

export type { UserContext };

// Load system prompt once at module init — fail hard if missing
const systemPrompt = loadSystemPrompt();

export interface ChatRequest {
  messages: ModelMessage[];
  userId?: string;
  userContext?: UserContext;
  settlementNotices?: Array<{ counterpartyWallet: string; amountUsd: string; description: string | null }>;
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

  // Phase 5: Debt and spending tools
  const createDebtTool = request.userId
    ? createCreateDebtTool(request.userId, resolvedUserContext)
    : undefined;
  const listDebtsTool = request.userId
    ? createListDebtsTool(request.userId, resolvedUserContext)
    : undefined;
  const getSpendingTool = request.userId
    ? createGetSpendingTool(request.userId)
    : undefined;
  const addContactTool = request.userId
    ? createAddContactTool(request.userId)
    : undefined;
  const listContactsTool = request.userId
    ? createListContactsTool(request.userId)
    : undefined;
  const settleCrosschainDebtTool = request.userId
    ? createSettleCrosschainDebtTool(request.userId, resolvedUserContext)
    : undefined;

  // Inject settlement notices into user message context (D-10)
  let enrichedUserMessage = userMessage;
  if (request.settlementNotices && request.settlementNotices.length > 0) {
    const noticeStr = request.settlementNotices
      .map(n => `${n.counterpartyWallet} sent $${n.amountUsd}${n.description ? ` (matched debt: ${n.description})` : ''} — auto-settled`)
      .join('; ');
    enrichedUserMessage = `[Settlement notices: ${noticeStr}]\n\n${userMessage}`;
  }

  // Separate history from the current message
  const history = messages.slice(0, -1);
  const ctx = assembleContext(systemPrompt, resolvedUserContext, history, enrichedUserMessage);

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
      ...(createDebtTool ? { create_debt: createDebtTool } : {}),
      ...(listDebtsTool ? { list_debts: listDebtsTool } : {}),
      ...(getSpendingTool ? { get_spending: getSpendingTool } : {}),
      ...(addContactTool ? { add_contact: addContactTool } : {}),
      ...(listContactsTool ? { list_contacts: listContactsTool } : {}),
      ...(settleCrosschainDebtTool ? { settle_crosschain_debt: settleCrosschainDebtTool } : {}),
    },
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    stopWhen: stepCountIs(5),
    onStepFinish: ({ toolResults }) => {
      if (toolResults && toolResults.length > 0) {
        console.log('[agent] tool results:', JSON.stringify(toolResults, null, 2));
      }
    },
    onFinish: ({ text, finishReason, totalUsage, steps }) => {
      console.log(
        `[agent] stream finished: finishReason=${finishReason}, textLength=${text.length}, steps=${steps.length}, inputTokens=${totalUsage.inputTokens}, outputTokens=${totalUsage.outputTokens}`,
      );
      if (text.length === 0) {
        console.warn('[agent] stream finished with empty text');
      }
    },
    onError: ({ error }) => {
      console.error('[agent] stream error:', error);
    },
  });

  return result;
}
