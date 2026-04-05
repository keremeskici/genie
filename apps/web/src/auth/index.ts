import { hashNonce } from '@/auth/wallet/client-helpers';
import { MiniKit } from '@worldcoin/minikit-js';
import type { MiniAppWalletAuthSuccessPayload } from '@worldcoin/minikit-js/commands';
import { verifySiweMessage } from '@worldcoin/minikit-js/siwe';
import NextAuth, { type DefaultSession } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

declare module 'next-auth' {
  interface User {
    walletAddress: string;
    username: string;
    profilePictureUrl: string;
    needsOnboarding: boolean;
  }

  interface Session {
    user: {
      walletAddress: string;
      username: string;
      profilePictureUrl: string;
      needsOnboarding: boolean;
    } & DefaultSession['user'];
  }
}

// Auth configuration for Wallet Auth based sessions
// For more information on each option (and a full list of options) go to
// https://authjs.dev/getting-started/authentication/credentials
export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 }, // 30 days
  providers: [
    Credentials({
      name: 'World App Wallet',
      credentials: {
        nonce: { label: 'Nonce', type: 'text' },
        signedNonce: { label: 'Signed Nonce', type: 'text' },
        finalPayloadJson: { label: 'Final Payload', type: 'text' },
      },
      // @ts-expect-error TODO
      authorize: async ({
        nonce,
        signedNonce,
        finalPayloadJson,
      }: {
        nonce: string;
        signedNonce: string;
        finalPayloadJson: string;
      }) => {
        console.log('[auth] authorize attempt started');
        const expectedSignedNonce = hashNonce({ nonce });

        if (signedNonce !== expectedSignedNonce) {
          console.error('[auth] Invalid signed nonce. Check HMAC_SECRET_KEY.');
          return null;
        }

        const finalPayload: MiniAppWalletAuthSuccessPayload =
          JSON.parse(finalPayloadJson);
        
        console.log('[auth] verifying SIWE message...');
        const result = await verifySiweMessage(finalPayload, nonce);

        if (!result.isValid || !result.siweMessageData.address) {
          console.error('[auth] SIWE verification failed:', result);
          return null;
        }

        console.log('[auth] fetching user info from MiniKit...');
        const userInfo = await MiniKit.getUserInfo(finalPayload.address);
        const walletAddress = result.siweMessageData.address;

        const apiUrl = process.env.NEXT_PUBLIC_API_URL;
        if (!apiUrl) {
          console.error('[auth] NEXT_PUBLIC_API_URL is missing in environment');
          return null;
        }

        console.log(`[auth] provisioning user at: ${apiUrl}/api/users/provision`);
        try {
          const provisionRes = await fetch(`${apiUrl}/api/users/provision`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              walletAddress,
              displayName: userInfo?.username ?? null,
            }),
          });

          if (!provisionRes.ok) {
            console.error('[auth] backend provisioning failed:', provisionRes.status, await provisionRes.text());
            return null;
          }

          const { userId, needsOnboarding } = await provisionRes.json();
          console.log('[auth] authorize successful for user:', userId);

          return {
            id: userId,
            walletAddress,
            needsOnboarding,
            username: userInfo?.username ?? '',
            profilePictureUrl: userInfo?.profilePictureUrl ?? '',
          };
        } catch (err) {
          console.error('[auth] fetch error during provisioning:', err);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;                     // UUID
        token.walletAddress = user.walletAddress;   // 0x address
        token.username = user.username;
        token.profilePictureUrl = user.profilePictureUrl;
        token.needsOnboarding = user.needsOnboarding;
      }

      return token;
    },
    session: async ({ session, token }) => {
      if (token.userId) {
        session.user.id = token.userId as string;
        session.user.walletAddress = token.walletAddress as string;
        session.user.username = (token.username as string) ?? '';
        session.user.profilePictureUrl = (token.profilePictureUrl as string) ?? '';
        session.user.needsOnboarding = (token.needsOnboarding as boolean) ?? false;
      }

      return session;
    },
  },
});
