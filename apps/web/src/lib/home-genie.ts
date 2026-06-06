export const HOME_CHAT_SEED_STORAGE_KEY = 'genie-home-chat-seed';

export type HomeGenieSuggestion = {
  message: string;
  followUp: string;
};

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) % 2147483647;
  }
  return hash;
}

export function getHomeGenieSuggestion(params: {
  balanceAmount: number | null;
  suggestedDepositAmount: string;
  userId: string;
  today?: Date;
}): HomeGenieSuggestion {
  const { balanceAmount, suggestedDepositAmount, userId, today = new Date() } = params;

  if (balanceAmount === null || Number.isNaN(balanceAmount)) {
    return {
      message: 'I can help you turn your USDC into a simple savings plan as soon as I can read your wallet balance.',
      followUp: 'Do you want me to walk you through a simple vault strategy once your balance loads?',
    };
  }

  if (balanceAmount <= 0) {
    return {
      message: 'Once you have USDC in your wallet, I can help you split it between spending money and longer-term savings.',
      followUp: 'When you are ready, do you want me to suggest a first savings move?',
    };
  }

  const prompts: HomeGenieSuggestion[] = [
    {
      message: `You have $${balanceAmount.toFixed(2)} in USDC. Want to put about $${suggestedDepositAmount} into a yield vault and keep the rest liquid?`,
      followUp: 'If that sounds good, I can open the vault deposit from chat and explain what it does.',
    },
    {
      message: `Do you want to start saving for a vacation? We could move about $${suggestedDepositAmount} into yield and let it earn while you plan the trip.`,
      followUp: 'Where are you thinking of going, and do you want me to sketch out a simple savings plan?',
    },
    {
      message: `You could turn part of this balance into a rainy-day fund. Putting about $${suggestedDepositAmount} into yield is one easy way to start.`,
      followUp: 'Do you want to keep it flexible for emergencies, or should I optimize more for growth?',
    },
  ];

  const dayKey = Number(today.toISOString().slice(0, 10).replace(/-/g, ''));
  const index = (hashString(userId || 'guest') + dayKey) % prompts.length;
  return prompts[index];
}
