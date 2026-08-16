import { describe, expect, it } from 'vitest';
import type { PlayerIndex } from '@dabb/shared-types';
import { resolveRematchStatus } from '../rematch.js';

const seats = (...indices: number[]) => indices as PlayerIndex[];

describe('resolveRematchStatus', () => {
  it('waits while a human seat has not answered', () => {
    const result = resolveRematchStatus({ '0': true }, seats(0, 1));

    expect(result.status).toBe('pending');
    expect(result.waitingFor).toEqual([1]);
    expect(result.declinedBy).toEqual([]);
  });

  it('agrees once every human seat said yes', () => {
    const result = resolveRematchStatus({ '0': true, '2': true }, seats(0, 2));

    expect(result.status).toBe('agreed');
    expect(result.waitingFor).toEqual([]);
  });

  it('counts AI seats as agreed without a vote', () => {
    // Seats 1 and 2 are bots and never write a vote — only the human is asked.
    const result = resolveRematchStatus({ '0': true }, seats(0));

    expect(result.status).toBe('agreed');
  });

  it('is declined as soon as one seat says no', () => {
    const result = resolveRematchStatus({ '0': true, '1': false, '2': true }, seats(0, 1, 2));

    expect(result.status).toBe('declined');
    expect(result.declinedBy).toEqual([1]);
  });

  it('declines even while another seat is still undecided', () => {
    const result = resolveRematchStatus({ '1': false }, seats(0, 1));

    expect(result.status).toBe('declined');
  });

  it('is pending with no known seats, not agreed (regression)', () => {
    // The seat list arrives with the session meta shortly after the game screen mounts.
    // Reading the empty list as unanimous consent started a rematch the moment the game
    // ended, before anyone had been asked.
    const result = resolveRematchStatus({}, seats());

    expect(result.status).toBe('pending');
  });
});
