/** Key-value storage backed by localStorage. */
export async function storageGet(key: string): Promise<string | null> {
  return localStorage.getItem(key);
}

export async function storageSet(key: string, value: string): Promise<void> {
  localStorage.setItem(key, value);
}

export async function storageDelete(key: string): Promise<void> {
  localStorage.removeItem(key);
}
