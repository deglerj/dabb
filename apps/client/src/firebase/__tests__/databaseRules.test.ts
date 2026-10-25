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
