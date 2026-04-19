import { describe, it, expect } from 'vitest';
import { requireVerified } from './require-verified';
import type { UserContext } from '../agent/context';

const verifiedCtx: UserContext = {
  walletAddress: '0xABC',
  displayName: 'Alice',
  autoApproveUsd: 25,
  isVerified: true,
  isHumanBacked: true,
};

const unverifiedCtx: UserContext = {
  walletAddress: '0xABC',
  displayName: 'Alice',
  autoApproveUsd: 25,
  isVerified: false,
  isHumanBacked: false,
};

describe('requireVerified', () => {
  it('returns null when user is verified (guard passes)', () => {
    expect(requireVerified(verifiedCtx)).toBeNull();
  });

  it('temporarily returns null when user is not verified', () => {
    expect(requireVerified(unverifiedCtx)).toBeNull();
  });

  it('does not return a verification error during the temporary bypass', () => {
    expect(requireVerified(unverifiedCtx)).toBeNull();
  });
});
