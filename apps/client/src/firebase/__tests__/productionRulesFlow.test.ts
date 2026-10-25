import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously, type User } from 'firebase/auth';
import {
  connectDatabaseEmulator,
  get,
  getDatabase,
  ref,
  runTransaction,
  set,
  type Database,
} from 'firebase/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const projectId = 'demo-dabb';
const databasePort = 9000;
const authPort = 9099;
const sessionCode = 'fresh-flow-331';

interface TestClient {
  app: FirebaseApp;
  authUser?: User;
  database: Database;
}

const clients: TestClient[] = [];

async function createClient(label: string, authenticate = true): Promise<TestClient> {
  const app = initializeApp(
    {
      apiKey: 'demo-api-key',
      authDomain: `${projectId}.firebaseapp.com`,
      databaseURL: `https://${projectId}-default-rtdb.firebaseio.com`,
      projectId,
      appId: `production-rules-${label}`,
    },
    `production-rules-${label}`
  );
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://127.0.0.1:${authPort}`, { disableWarnings: true });
  const database = getDatabase(app);
  connectDatabaseEmulator(database, '127.0.0.1', databasePort);
  const client: TestClient = { app, database };
  if (authenticate) {
    client.authUser = (await signInAnonymously(auth)).user;
  }
  clients.push(client);
  return client;
}

async function clearDatabase(): Promise<void> {
  const response = await fetch(`http://127.0.0.1:${databasePort}/.json?ns=${projectId}`, {
    method: 'DELETE',
  });
  expect(response.ok).toBe(true);
}

async function expectDenied(operation: Promise<unknown>): Promise<void> {
  await expect(operation).rejects.toThrow(/Permission denied|PERMISSION_DENIED/);
}

function event(actor: number, id: string, claimId?: string) {
  return {
    id,
    sessionId: sessionCode,
    sequence: 1,
    timestamp: Date.now(),
    actor,
    type: 'BID_PLACED',
    payload: { playerIndex: actor, amount: 150 },
    ...(claimId ? { claimId } : {}),
  };
}

describe.skipIf(process.env.DABB_PRODUCTION_RULES_TEST !== 'true')(
  'fresh flow against production rules and the Auth emulator',
  () => {
    let host: TestClient;
    let firstGuest: TestClient;
    let guest: TestClient;
    let outsider: TestClient;
    let unauthenticated: TestClient;

    beforeAll(async () => {
      await clearDatabase();
      host = await createClient('host');
      firstGuest = await createClient('first-guest');
      guest = await createClient('guest');
      outsider = await createClient('outsider');
      unauthenticated = await createClient('unauthenticated', false);
    });

    afterAll(async () => {
      await Promise.all(clients.map(({ app }) => deleteApp(app)));
    });

    it('completes a fresh game, delegated AI turn, side channels, and rematch handoff', async () => {
      const hostUid = host.authUser?.uid;
      const firstGuestUid = firstGuest.authUser?.uid;
      const guestUid = guest.authUser?.uid;
      const outsiderUid = outsider.authUser?.uid;
      expect(hostUid).toBeTruthy();
      expect(firstGuestUid).toBeTruthy();
      expect(guestUid).toBeTruthy();
      expect(outsiderUid).toBeTruthy();

      const createdAt = Date.now();
      const hostSeat = { nickname: 'Host', ownerUid: hostUid, isAI: false };
      const guestSeat = { nickname: 'Guest', ownerUid: guestUid, isAI: false };
      const botSeat = { nickname: 'Bot Fritz', isAI: true, aiDifficulty: 'medium' };

      // Fresh create: the authenticated host owns the waiting room and publishes its index.
      await set(ref(host.database, `sessions/${sessionCode}/meta`), {
        playerCount: 3,
        targetScore: 1000,
        status: 'waiting',
        createdAt,
        players: { '0': hostSeat },
      });
      await set(ref(host.database, `sessions/${sessionCode}/join`), {
        schemaVersion: 2,
        playerCount: 3,
        status: 'waiting',
        createdAt,
        players: { '0': { nickname: 'Host', isAI: false } },
      });
      await set(ref(host.database, `lobby/${sessionCode}`), {
        host: 'Host',
        playerCount: 3,
        taken: 1,
        createdAt,
      });
      await expect(
        get(ref(unauthenticated.database, `lobby/${sessionCode}`))
      ).resolves.toBeTruthy();
      await expectDenied(get(ref(unauthenticated.database, `sessions/${sessionCode}/meta`)));
      await expectDenied(get(ref(unauthenticated.database, `sessions/${sessionCode}/join`)));
      await expectDenied(
        set(ref(host.database, 'sessions/legacy-331/meta'), {
          playerCount: 2,
          targetScore: 1000,
          status: 'waiting',
          createdAt,
          players: {
            '0': { nickname: 'Legacy', ownerUid: hostUid, isAI: false, secretHash: 'legacy' },
          },
        })
      );

      // Waiting-room ownership: a fresh authenticated user claims a seat, leaves it, and the
      // next user reclaims it. The former owner and a non-host cannot rewrite the host listing.
      await expect(
        get(ref(firstGuest.database, `sessions/${sessionCode}/join`))
      ).resolves.toBeTruthy();
      await set(ref(firstGuest.database, `sessions/${sessionCode}/meta/players/1`), {
        nickname: 'First guest',
        ownerUid: firstGuestUid,
        isAI: false,
      });
      await set(ref(firstGuest.database, `sessions/${sessionCode}/meta/players/1`), {
        nickname: 'First guest',
        ownerUid: firstGuestUid,
        isAI: false,
        left: true,
      });
      await set(ref(guest.database, `sessions/${sessionCode}/meta/players/1`), guestSeat);
      await expectDenied(
        set(ref(firstGuest.database, `sessions/${sessionCode}/meta/players/1`), {
          nickname: 'Hijack',
          ownerUid: firstGuestUid,
          isAI: false,
        })
      );
      await expectDenied(
        set(ref(guest.database, `lobby/${sessionCode}`), {
          host: 'Imposter',
          playerCount: 3,
          taken: 2,
          createdAt,
        })
      );
      await expectDenied(
        set(ref(guest.database, `sessions/${sessionCode}/meta/players/0`), {
          nickname: 'Hijack',
          ownerUid: guestUid,
          isAI: false,
        })
      );
      await set(ref(guest.database, `sessions/${sessionCode}/join`), {
        schemaVersion: 2,
        playerCount: 3,
        status: 'waiting',
        createdAt,
        players: {
          '0': { nickname: 'Host', isAI: false },
          '1': { nickname: 'Guest', isAI: false },
        },
      });
      await expectDenied(
        set(ref(host.database, `sessions/${sessionCode}/meta/players/2`), {
          ...botSeat,
          secretHash: 'legacy',
        })
      );
      await set(ref(host.database, `sessions/${sessionCode}/meta/players/2`), botSeat);
      await set(ref(host.database, `sessions/${sessionCode}/join`), {
        schemaVersion: 2,
        playerCount: 3,
        status: 'waiting',
        createdAt,
        players: {
          '0': { nickname: 'Host', isAI: false },
          '1': { nickname: 'Guest', isAI: false },
          '2': { nickname: 'Bot Fritz', isAI: true },
        },
      });
      await set(ref(host.database, `lobby/${sessionCode}`), null);

      // Start: only seat 0 can activate the game and close the waiting-room projection.
      await expectDenied(set(ref(guest.database, `sessions/${sessionCode}/meta/status`), 'active'));
      await set(ref(host.database, `sessions/${sessionCode}/meta/status`), 'active');
      await set(ref(host.database, `sessions/${sessionCode}/join`), null);
      await expect(get(ref(guest.database, `sessions/${sessionCode}/meta`))).resolves.toBeTruthy();
      await expectDenied(
        set(ref(outsider.database, `sessions/${sessionCode}/meta/status`), 'finished')
      );

      // Human gameplay: both authenticated human seats write actor-bound game events.
      await set(ref(host.database, `sessions/${sessionCode}/events/start`), {
        ...event(0, 'start'),
        type: 'GAME_STARTED',
        payload: { playerCount: 3, targetScore: 1000, dealer: 0 },
      });
      await set(
        ref(host.database, `sessions/${sessionCode}/events/host-bid`),
        event(0, 'host-bid')
      );
      await set(
        ref(guest.database, `sessions/${sessionCode}/events/guest-bid`),
        event(1, 'guest-bid')
      );
      await expectDenied(
        set(
          ref(guest.database, `sessions/${sessionCode}/events/cross-seat`),
          event(0, 'cross-seat')
        )
      );
      await expectDenied(
        set(ref(guest.database, `sessions/${sessionCode}/events/legacy-field`), {
          ...event(1, 'legacy-field'),
          authorHash: 'legacy',
        })
      );
      await expectDenied(
        set(ref(guest.database, `sessions/${sessionCode}/events/null-actor`), {
          ...event(1, 'null-actor'),
          actor: null,
        })
      );
      await expectDenied(
        set(ref(guest.database, `sessions/${sessionCode}/events/null-claim`), {
          ...event(2, 'null-claim'),
          claimId: null,
        })
      );
      await expectDenied(
        set(
          ref(unauthenticated.database, `sessions/${sessionCode}/events/unauthenticated`),
          event(1, 'unauthenticated')
        )
      );

      // Delegated AI execution: a current claim grants exactly one AI seat's cascade.
      const claimRef = ref(guest.database, `sessions/${sessionCode}/aiClaims/turn-1`);
      await set(claimRef, {
        playerIndex: 2,
        claimedBy: guestUid,
        claimedAt: Date.now(),
      });
      await set(
        ref(guest.database, `sessions/${sessionCode}/events/ai-action`),
        event(2, 'ai-action', 'turn-1')
      );
      await expectDenied(
        set(
          ref(guest.database, `sessions/${sessionCode}/events/ai-cross-seat`),
          event(1, 'ai-cross-seat', 'turn-1')
        )
      );
      await expectDenied(
        set(
          ref(guest.database, `sessions/${sessionCode}/events/ai-missing-claim`),
          event(2, 'ai-missing-claim')
        )
      );
      await set(ref(guest.database, `sessions/${sessionCode}/aiClaims/stale`), {
        playerIndex: 2,
        claimedBy: guestUid,
        claimedAt: Date.now() - 10_001,
      });
      await expectDenied(
        set(
          ref(guest.database, `sessions/${sessionCode}/events/ai-stale-claim`),
          event(2, 'ai-stale-claim', 'stale')
        )
      );
      await expectDenied(
        set(ref(outsider.database, `sessions/${sessionCode}/aiClaims/outsider`), {
          playerIndex: 2,
          claimedBy: outsiderUid,
          claimedAt: Date.now(),
        })
      );
      const transactionResult = await runTransaction(
        ref(guest.database, `sessions/${sessionCode}/aiClaims/turn-2`),
        () => ({ playerIndex: 2, claimedBy: guestUid, claimedAt: Date.now() })
      );
      expect(transactionResult.committed).toBe(true);

      // Every ephemeral side channel remains authenticated and seat-owned.
      await set(ref(host.database, `sessions/${sessionCode}/presence/0`), { connected: true });
      await set(ref(guest.database, `sessions/${sessionCode}/presence/1`), { connected: true });
      await set(ref(host.database, `sessions/${sessionCode}/emotes/0`), {
        key: 'laugh',
        at: Date.now(),
      });
      await set(ref(guest.database, `sessions/${sessionCode}/emotes/1`), {
        key: 'laugh',
        at: Date.now(),
      });
      await expectDenied(
        set(ref(guest.database, `sessions/${sessionCode}/presence/0`), { connected: true })
      );
      await expectDenied(
        set(ref(guest.database, `sessions/${sessionCode}/emotes/0`), {
          key: 'laugh',
          at: Date.now(),
        })
      );
      await expectDenied(
        set(ref(unauthenticated.database, `sessions/${sessionCode}/rematch/votes/1`), true)
      );
      await expectDenied(set(ref(guest.database, `sessions/${sessionCode}/rematch/votes/2`), true));

      // Finish and hand off a new active session. Original humans vote and claim only their seats;
      // the host publishes a one-time code for that authenticated rematch.
      await set(ref(host.database, `sessions/${sessionCode}/meta/status`), 'finished');
      const rematchCode = 'fresh-rematch-331';
      await set(ref(host.database, `sessions/${rematchCode}/meta`), {
        playerCount: 3,
        targetScore: 1000,
        status: 'active',
        createdAt: Date.now(),
        rematchOf: sessionCode,
        players: {
          '0': hostSeat,
          '2': botSeat,
        },
      });
      await expectDenied(
        set(ref(guest.database, `sessions/${sessionCode}/rematch/code`), rematchCode)
      );
      await set(ref(host.database, `sessions/${sessionCode}/rematch/code`), rematchCode);
      await expectDenied(
        set(ref(host.database, `sessions/${sessionCode}/rematch/code`), 'forged-rematch')
      );
      await set(ref(guest.database, `sessions/${rematchCode}/meta/players/1`), guestSeat);
      await expectDenied(
        set(ref(host.database, `sessions/${rematchCode}/meta/players/1`), {
          nickname: 'Imposter',
          ownerUid: hostUid,
          isAI: false,
        })
      );
      await expectDenied(
        set(ref(outsider.database, `sessions/${rematchCode}/meta/players/1`), {
          nickname: 'Outsider',
          ownerUid: outsiderUid,
          isAI: false,
        })
      );
      await expectDenied(
        set(ref(guest.database, `sessions/${rematchCode}/meta/players/2`), {
          nickname: 'Imposter',
          ownerUid: guestUid,
          isAI: false,
        })
      );
      await set(ref(host.database, `sessions/${sessionCode}/rematch/votes/0`), true);
      await set(ref(guest.database, `sessions/${sessionCode}/rematch/votes/1`), true);
      await expectDenied(set(ref(guest.database, `sessions/${sessionCode}/rematch/votes/0`), true));

      // Read back the fresh flow through the authenticated member boundary.
      await expect(
        get(ref(guest.database, `sessions/${sessionCode}/events`))
      ).resolves.toBeTruthy();
      const rematchSnapshot = await get(ref(guest.database, `sessions/${rematchCode}/meta`));
      expect(rematchSnapshot.val()).toMatchObject({
        status: 'active',
        rematchOf: sessionCode,
      });
      await expectDenied(get(ref(outsider.database, `sessions/${sessionCode}/events`)));
      await expectDenied(get(ref(unauthenticated.database, `sessions/${sessionCode}/events`)));
    });
  }
);
