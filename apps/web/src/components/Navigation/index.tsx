'use client';

import { TabItem, Tabs } from '@worldcoin/mini-apps-ui-kit-react';
import { Bank, ChatBubble, Home, User } from 'iconoir-react';
import { usePathname, useRouter } from 'next/navigation';

const ROUTES: Record<string, string> = {
  home: '/home',
  chat: '/chat',
  wallet: '/wallet',
  profile: '/profile',
};

const PATH_TO_TAB: Record<string, string> = {
  '/home': 'home',
  '/chat': 'chat',
  '/wallet': 'wallet',
  '/profile': 'profile',
};

export const Navigation = () => {
  const router = useRouter();
  const pathname = usePathname();
  const value = PATH_TO_TAB[pathname] ?? 'home';

  const handleChange = (tab: string) => {
    const route = ROUTES[tab];
    if (route) router.push(route);
  };

  return (
    <Tabs value={value} onValueChange={handleChange}>
      <TabItem value="home" icon={<Home />} label="Home" />
      <TabItem value="chat" icon={<ChatBubble />} label="Chat" />
      <TabItem value="wallet" icon={<Bank />} label="Wallet" />
      <TabItem value="profile" icon={<User />} label="Profile" />
    </Tabs>
  );
};
