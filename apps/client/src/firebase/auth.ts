import { onAuthStateChanged, signInAnonymously, type User } from 'firebase/auth';
import { auth } from './config.js';

let authReadyPromise: Promise<User> | undefined;

/** Resolve once Firebase Auth has an anonymous identity for this browser. */
export function ensureAuthenticated(): Promise<User> {
  authReadyPromise ??= new Promise<User>((resolve, reject) => {
    let signingIn = false;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        unsubscribe();
        resolve(user);
      } else if (!signingIn) {
        signingIn = true;
        void signInAnonymously(auth).catch((error: unknown) => {
          unsubscribe();
          reject(error);
        });
      }
    });
  }).catch((error: unknown) => {
    authReadyPromise = undefined;
    throw error;
  });

  return authReadyPromise;
}
