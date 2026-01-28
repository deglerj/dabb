import { describe, expect, it } from 'vitest';

import {
  getBiddingWinner,
  getFirstBidder,
  getMinBid,
  getNextBidder,
  isBiddingComplete,
  isValidBid,
} from '../phases/bidding.js';

describe('Bidding Logic', () => {
  describe('getFirstBidder', () => {
    it('returns player after dealer', () => {
      expect(getFirstBidder(0, 4)).toBe(1);
      expect(getFirstBidder(3, 4)).toBe(0);
      expect(getFirstBidder(2, 3)).toBe(0);
    });
  });

  describe('getNextBidder', () => {
    it('returns next player who has not passed', () => {
      const passed = new Set<0 | 1 | 2 | 3>();
      expect(getNextBidder(0, 4, passed)).toBe(1);
      expect(getNextBidder(3, 4, passed)).toBe(0);
    });

    it('skips passed players', () => {
      const passed = new Set<0 | 1 | 2 | 3>([1]);
      expect(getNextBidder(0, 4, passed)).toBe(2);
    });

    it('returns null if no active players', () => {
      const passed = new Set<0 | 1 | 2 | 3>([0, 1, 2, 3]);
      expect(getNextBidder(0, 4, passed)).toBe(null);
    });
  });

  describe('isValidBid', () => {
    it('accepts minimum bid of 150 at start', () => {
      expect(isValidBid(150, 0)).toBe(true);
    });

    it('rejects bids below minimum', () => {
      expect(isValidBid(140, 0)).toBe(false);
    });

    it('requires increment of 10 after first bid', () => {
      expect(isValidBid(160, 150)).toBe(true);
      expect(isValidBid(155, 150)).toBe(false);
      expect(isValidBid(150, 150)).toBe(false);
    });

    it('accepts higher increments', () => {
      expect(isValidBid(200, 150)).toBe(true);
    });
  });

  describe('getMinBid', () => {
    it('returns 150 at start', () => {
      expect(getMinBid(0)).toBe(150);
    });

    it('returns current + 10 after first bid', () => {
      expect(getMinBid(150)).toBe(160);
      expect(getMinBid(200)).toBe(210);
    });
  });

  describe('isBiddingComplete', () => {
    it('returns false while multiple players active', () => {
      const passed = new Set<0 | 1 | 2 | 3>([0]);
      expect(isBiddingComplete(4, passed)).toBe(false);
    });

    it('returns true when only one player left', () => {
      const passed = new Set<0 | 1 | 2 | 3>([0, 1, 2]);
      expect(isBiddingComplete(4, passed)).toBe(true);
    });

    it('returns true when all players passed', () => {
      const passed = new Set<0 | 1 | 2 | 3>([0, 1, 2, 3]);
      expect(isBiddingComplete(4, passed)).toBe(true);
    });
  });

  describe('getBiddingWinner', () => {
    it('returns the only active player', () => {
      const passed = new Set<0 | 1 | 2 | 3>([0, 1, 3]);
      expect(getBiddingWinner(4, passed)).toBe(2);
    });

    it('returns null if all passed', () => {
      const passed = new Set<0 | 1 | 2 | 3>([0, 1, 2, 3]);
      expect(getBiddingWinner(4, passed)).toBe(null);
    });
  });
});
