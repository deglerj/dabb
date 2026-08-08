export async function getOrCreateSecretId(sessionCode: string): Promise<string> {
  const key = `dabb-secret-${sessionCode}`;
  const existing = localStorage.getItem(key);
  if (existing) {
    return existing;
  }

  const newId = crypto.randomUUID();
  localStorage.setItem(key, newId);
  return newId;
}

export async function hashSecretId(secretId: string): Promise<string> {
  const data = new TextEncoder().encode(secretId);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
