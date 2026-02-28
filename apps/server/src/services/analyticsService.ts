/**
 * Analytics service — tracks events via Umami
 * Fire-and-forget: never blocks game logic, errors are logged as warnings only.
 * No-op when UMAMI_WEBSITE_ID is not configured.
 */

import { gameLogger } from '../utils/logger.js';

export function trackEvent(name: string, data?: Record<string, string | number | boolean>): void {
  const umamiUrl = process.env.UMAMI_URL;
  const umamiWebsiteId = process.env.UMAMI_WEBSITE_ID;
  if (!umamiUrl || !umamiWebsiteId) {
    return;
  }

  const body = JSON.stringify({
    type: 'event',
    payload: {
      website: umamiWebsiteId,
      url: '/',
      name,
      ...(data && { data }),
    },
  });

  fetch(`${umamiUrl}/api/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  }).catch((err: unknown) => {
    gameLogger.warn({ err }, 'Failed to send analytics event');
  });
}
