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

  it('returns VERIFICATION_REQUIRED error when user is not verified', () => {
    const result = requireVerified(unverifiedCtx);
    expect(result).not.toBeNull();
    expect(result!.error).toBe('VERIFICATION_REQUIRED');
    expect(result!.message).toBe('This action requires World ID verification. Please verify to continue.');
  });

  it('error object has exactly error and message keys', () => {
    const result = requireVerified(unverifiedCtx);
    expect(Object.keys(result!).sort()).toEqual(['error', 'message']);
  });
});
