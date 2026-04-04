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
  session: { strategy: 'jwt' },
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
        const expectedSignedNonce = hashNonce({ nonce });

        if (signedNonce !== expectedSignedNonce) {
          console.log('Invalid signed nonce');
          return null;
        }

        const finalPayload: MiniAppWalletAuthSuccessPayload =
          JSON.parse(finalPayloadJson);
        const result = await verifySiweMessage(finalPayload, nonce);

        if (!result.isValid || !result.siweMessageData.address) {
          console.log('Invalid final payload');
          return null;
        }

        // Optionally, fetch the user info from your own database
        const userInfo = await MiniKit.getUserInfo(finalPayload.address);

        const walletAddress = result.siweMessageData.address;

        // D-01: Provision user in backend — get-or-create by wallet address, returns UUID
        const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
        const provisionRes = await fetch(`${apiUrl}/api/users/provision`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress,
            displayName: userInfo?.username ?? null,
          }),
        });

        // D-04: If provisioning fails, fail auth entirely
        if (!provisionRes.ok) {
          console.error('[auth] provisioning failed:', await provisionRes.text());
          return null;
        }

        const { userId, needsOnboarding } = await provisionRes.json();

        return {
          id: userId,                              // D-13: UUID from DB
          walletAddress,                           // D-13: separate field
          needsOnboarding,                         // D-15: computed flag
          username: userInfo?.username ?? '',
          profilePictureUrl: userInfo?.profilePictureUrl ?? '',
        };
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
