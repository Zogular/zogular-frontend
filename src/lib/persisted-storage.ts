export function migrateLocalStorageValue(currentKey: string, legacyKeys: string[]): void {
  if (typeof window === "undefined") return;

  const storage = window.localStorage;
  if (storage.getItem(currentKey)) return;

  const legacyKey = legacyKeys.find((key) => storage.getItem(key));
  if (!legacyKey) return;

  const legacyValue = storage.getItem(legacyKey);
  if (legacyValue) {
    storage.setItem(currentKey, legacyValue);
  }
}

export function readLocalStorageValue(currentKey: string, legacyKeys: string[] = []): string | null {
  if (typeof window === "undefined") return null;

  const storage = window.localStorage;
  const currentValue = storage.getItem(currentKey);
  if (currentValue) return currentValue;

  for (const legacyKey of legacyKeys) {
    const legacyValue = storage.getItem(legacyKey);
    if (legacyValue) {
      storage.setItem(currentKey, legacyValue);
      return legacyValue;
    }
  }

  return null;
}
