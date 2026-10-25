import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';

const projectId = 'demo-dabb';
const rules = fs.readFileSync(path.resolve(process.cwd(), '../../database.rules.json'), 'utf8');
const stale = Date.now() - 3_600_001;

function waitingSession(status: 'waiting' | 'active' | 'finished' = 'waiting') {
  return {
    meta: {
      playerCount: 3,
      targetScore: 1000,
      status,
      createdAt: stale,
      players: {
        '0': { nickname: 'Hans', ownerUid: 'host', isAI: false },
        '1': { nickname: 'Klara', ownerUid: 'human', isAI: false },
        '2': { nickname: 'Bot Fritz', isAI: true, aiDifficulty: 'medium' },
      },
    },
    join: {
      schemaVersion: 2,
      playerCount: 3,
      status,
      createdAt: stale,
      players: {
        '0': { nickname: 'Hans', isAI: false },
        '1': { nickname: 'Klara', isAI: false },
        '2': { nickname: 'Bot Fritz', isAI: true },
      },
    },
  };
}

function lobbyEntry() {
  return {
    host: 'Hans',
    playerCount: 3,
    taken: 3,
    createdAt: stale,
  };
}

function event(actor: number, sessionId = 'room', claimId?: string) {
  return {
    id: `${sessionId}-${actor}`,
    sessionId,
    sequence: 1,
    timestamp: Date.now(),
    actor,
    type: 'BID_PLACED',
    ...(claimId ? { claimId } : {}),
  };
}

describe.skipIf(process.env.DABB_RULES_TEST !== 'true')('database ownership rules', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId,
      database: { rules, host: '127.0.0.1', port: 9000 },
    });
  });

  beforeEach(async () => {
    await testEnv.clearDatabase();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.database().ref('sessions/room').set(waitingSession());
      await context.database().ref('lobby/room').set(lobbyEntry());
    });
  });

  afterAll(async () => {
    await testEnv?.cleanup();
  });

  it('allows only the host to start, and freezes seats after activation', async () => {
    const host = testEnv.authenticatedContext('host').database();
    const human = testEnv.authenticatedContext('human').database();

    await assertSucceeds(host.ref('sessions/room/meta/status').set('active'));
    await assertFails(human.ref('sessions/room/meta/status').set('finished'));
    await assertFails(host.ref('sessions/room/meta/players/2').remove());
    await assertFails(
      host.ref('sessions/room/meta/players/1').set({
        nickname: 'Hijack',
        ownerUid: 'host',
        isAI: false,
      })
    );
    await assertFails(
      human.ref('sessions/room/meta/players/1').set({
        nickname: 'Changed',
        ownerUid: 'human',
        isAI: false,
      })
    );
  });

  it('lets a human leave only their own waiting seat and lets the next user reclaim it', async () => {
    const human = testEnv.authenticatedContext('human').database();
    const rival = testEnv.authenticatedContext('rival').database();

    await assertFails(
      rival.ref('sessions/room/meta/players/1').set({
        nickname: 'Gone',
        ownerUid: 'human',
        isAI: false,
        left: true,
      })
    );
    await assertSucceeds(
      human.ref('sessions/room/meta/players/1').set({
        nickname: 'Klara',
        ownerUid: 'human',
        isAI: false,
        left: true,
      })
    );
    await assertSucceeds(
      rival.ref('sessions/room/meta/players/1').set({
        nickname: 'Bea',
        ownerUid: 'rival',
        isAI: false,
      })
    );
    await assertFails(
      human.ref('sessions/room/meta/players/1').set({
        nickname: 'Hijack',
        ownerUid: 'human',
        isAI: false,
      })
    );
  });

  it('does not let anyone reclaim the host seat after the host leaves', async () => {
    const host = testEnv.authenticatedContext('host').database();
    const rival = testEnv.authenticatedContext('rival').database();

    await assertSucceeds(
      host.ref('sessions/room/meta/players/0').set({
        nickname: 'Hans',
        ownerUid: 'host',
        isAI: false,
        left: true,
      })
    );
    await assertFails(
      rival.ref('sessions/room/meta/players/0').set({
        nickname: 'Bea',
        ownerUid: 'rival',
        isAI: false,
      })
    );
    await assertFails(
      rival.ref('sessions/room/meta/players/1').set({
        nickname: 'Bea',
        ownerUid: 'rival',
        isAI: false,
      })
    );
  });

  it('restricts AI-seat lifecycle to the host', async () => {
    const host = testEnv.authenticatedContext('host').database();
    const human = testEnv.authenticatedContext('human').database();

    await assertSucceeds(host.ref('sessions/room/meta/players/2/nickname').set('Bot Bea'));
    await assertSucceeds(host.ref('sessions/room/meta/players/2').remove());
    await assertSucceeds(
      host.ref('sessions/room/meta/players/2').set({
        nickname: 'Bot Ute',
        isAI: true,
        aiDifficulty: 'hard',
      })
    );
    await assertFails(human.ref('sessions/room/meta/players/2/nickname').set('Hostile Bot'));
    await assertFails(human.ref('sessions/room/meta/players/2').remove());
  });

  it('keeps lobby writes host-owned while allowing only stale waiting cleanup', async () => {
    const host = testEnv.authenticatedContext('host').database();
    const human = testEnv.authenticatedContext('human').database();
    const unauthenticated = testEnv.unauthenticatedContext().database();

    await assertSucceeds(unauthenticated.ref('lobby/room').get());
    await assertSucceeds(host.ref('lobby/room').set({ ...lobbyEntry(), taken: 2 }));
    await assertFails(host.ref('lobby/room').set({ ...lobbyEntry(), host: 'Imposter' }));
    await assertFails(human.ref('lobby/room').set({ ...lobbyEntry(), taken: 1 }));
    await assertFails(human.ref('lobby/new-room').set(lobbyEntry()));
    await assertSucceeds(human.ref('lobby/room').remove());
    await assertSucceeds(human.ref('sessions/room').remove());
  });

  it('authorizes events by human seat and rejects bearer or cross-seat writes', async () => {
    const host = testEnv.authenticatedContext('host').database();
    const human = testEnv.authenticatedContext('human').database();

    await assertSucceeds(host.ref('sessions/room/meta/status').set('active'));
    await assertSucceeds(human.ref('sessions/room/events/human').set(event(1)));
    await assertFails(human.ref('sessions/room/events/host-seat').set(event(0)));
    await assertFails(
      human.ref('sessions/room/events/secret').set({ ...event(1), authorHash: 'human' })
    );
    await assertFails(
      human.ref('sessions/room/events/missing-actor').set({ ...event(1, 'room'), actor: null })
    );
    await assertFails(human.ref('sessions/room/events/wrong-session').set(event(1, 'other')));
  });

  it('authorizes an AI cascade only through a current claim for that AI seat', async () => {
    const host = testEnv.authenticatedContext('host').database();
    const human = testEnv.authenticatedContext('human').database();
    const rival = testEnv.authenticatedContext('rival').database();

    await assertSucceeds(host.ref('sessions/room/meta/status').set('active'));
    await assertSucceeds(
      human.ref('sessions/room/aiClaims/turn-1').set({
        playerIndex: 2,
        claimedBy: 'human',
        claimedAt: Date.now(),
      })
    );
    await assertSucceeds(
      human.ref('sessions/room/events/ai-action').set(event(2, 'room', 'turn-1'))
    );
    await assertFails(
      human.ref('sessions/room/events/ai-cross-seat').set(event(1, 'room', 'turn-1'))
    );
    await assertFails(human.ref('sessions/room/events/ai-missing-claim').set(event(2, 'room')));
    await assertFails(
      human.ref('sessions/room/events/ai-null-claim').set({ ...event(2), claimId: null })
    );
    await assertFails(
      rival.ref('sessions/room/aiClaims/outsider').set({
        playerIndex: 2,
        claimedBy: 'rival',
        claimedAt: Date.now(),
      })
    );

    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context
        .database()
        .ref('sessions/room/aiClaims/expired')
        .set({
          playerIndex: 2,
          claimedBy: 'human',
          claimedAt: Date.now() - 10_001,
        });
    });
    await assertFails(
      human.ref('sessions/room/events/ai-expired').set(event(2, 'room', 'expired'))
    );
  });

  it('restricts presence, emotes, and rematch votes to the owning human seat', async () => {
    const host = testEnv.authenticatedContext('host').database();
    const human = testEnv.authenticatedContext('human').database();
    const unauthenticated = testEnv.unauthenticatedContext().database();

    await assertSucceeds(host.ref('sessions/room/presence/0').set({ connected: true }));
    await assertFails(human.ref('sessions/room/presence/0').set({ connected: true }));
    await assertSucceeds(human.ref('sessions/room/presence/1').set({ connected: true }));
    await assertFails(unauthenticated.ref('sessions/room/presence/1').set({ connected: true }));

    await assertSucceeds(host.ref('sessions/room/emotes/0').set({ key: 'laugh', at: Date.now() }));
    await assertFails(human.ref('sessions/room/emotes/0').set({ key: 'laugh', at: Date.now() }));
    await assertSucceeds(human.ref('sessions/room/emotes/1').set({ key: 'laugh', at: Date.now() }));
    await assertFails(
      unauthenticated.ref('sessions/room/emotes/1').set({ key: 'laugh', at: Date.now() })
    );

    await assertSucceeds(host.ref('sessions/room/rematch/votes/0').set(true));
    await assertFails(human.ref('sessions/room/rematch/votes/0').set(true));
    await assertSucceeds(human.ref('sessions/room/rematch/votes/1').set(true));
    await assertFails(unauthenticated.ref('sessions/room/rematch/votes/1').set(true));
    await assertFails(human.ref('sessions/room/presence/2').set({ connected: true }));
    await assertFails(human.ref('sessions/room/emotes/2').set({ key: 'laugh', at: Date.now() }));
    await assertFails(human.ref('sessions/room/rematch/votes/2').set(true));
  });

  it('lets each original human claim only their own rematch seat', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.database().ref('sessions/room/meta/status').set('finished');
      await context
        .database()
        .ref('sessions/rematch')
        .set({
          meta: {
            playerCount: 3,
            targetScore: 1000,
            status: 'active',
            createdAt: Date.now(),
            rematchOf: 'room',
            players: {
              '0': { nickname: 'Hans', ownerUid: 'host', isAI: false },
              '2': { nickname: 'Bot Fritz', isAI: true },
            },
          },
        });
    });

    const host = testEnv.authenticatedContext('host').database();
    const human = testEnv.authenticatedContext('human').database();
    const unauthenticated = testEnv.unauthenticatedContext().database();
    const seat = {
      nickname: 'Klara',
      ownerUid: 'human',
      isAI: false,
    };

    await assertSucceeds(human.ref('sessions/rematch/meta/players/1').set(seat));
    await assertFails(
      host.ref('sessions/rematch/meta/players/1').set({ ...seat, ownerUid: 'host' })
    );
    await assertFails(
      human.ref('sessions/rematch/meta/players/2').set({ ...seat, ownerUid: 'human' })
    );
    await assertFails(unauthenticated.ref('sessions/rematch/meta/players/1').set(seat));
  });

  it('does not let cleanup remove active or finished sessions', async () => {
    const host = testEnv.authenticatedContext('host').database();
    const human = testEnv.authenticatedContext('human').database();

    await assertSucceeds(host.ref('sessions/room/meta/status').set('active'));
    await assertFails(host.ref('lobby/room').remove());
    await assertFails(human.ref('lobby/room').remove());
    await assertFails(human.ref('sessions/room').remove());

    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.database().ref('sessions/finished').set(waitingSession('finished'));
      await context.database().ref('lobby/finished').set(lobbyEntry());
    });
    await assertFails(human.ref('sessions/finished').remove());
    await assertFails(human.ref('lobby/finished').remove());
  });
});
