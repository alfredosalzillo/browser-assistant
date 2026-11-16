/**
 * Storage abstraction for persisting assistant sessions.
 *
 * All methods are async to allow remote or delayed storage implementations.
 */

export interface AssistantStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/**
 * InMemoryStorage is a non-persistent storage implementation backed by a plain `Map`.
 * Sessions are lost on page reload. Useful for testing or when persistence is not desired.
 *
 * It provides both static and instance methods so it can be passed as `storage: InMemoryStorage`
 * or `storage: new InMemoryStorage()`.
 */
export class InMemoryStorage implements AssistantStorage {
  static readonly #shared = new InMemoryStorage();
  readonly #store = new Map<string, string>();

  static async getItem(key: string): Promise<string | null> {
    return InMemoryStorage.#shared.getItem(key);
  }

  static async setItem(key: string, value: string): Promise<void> {
    return InMemoryStorage.#shared.setItem(key, value);
  }

  static async removeItem(key: string): Promise<void> {
    return InMemoryStorage.#shared.removeItem(key);
  }

  async getItem(key: string): Promise<string | null> {
    return this.#store.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.#store.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.#store.delete(key);
  }
}

/**
 * LocalStorage wraps the browser's `localStorage` global, falling back to `InMemoryStorage`
 * when `localStorage` is unavailable (e.g. Node.js, private browsing quota, security restrictions).
 *
 * Sessions persist across page refreshes when `localStorage` is available.
 *
 * It provides both static and instance methods so it can be passed as `storage: LocalStorage`
 * or `storage: new LocalStorage()`.
 */
export class LocalStorage implements AssistantStorage {
  static async getItem(key: string): Promise<string | null> {
    try {
      if (typeof globalThis.localStorage?.getItem === "function") {
        return globalThis.localStorage.getItem(key);
      }
    } catch {
      // Ignore security errors or disabled localStorage
    }
    return InMemoryStorage.getItem(key);
  }

  static async setItem(key: string, value: string): Promise<void> {
    try {
      if (typeof globalThis.localStorage?.setItem === "function") {
        globalThis.localStorage.setItem(key, value);
        return;
      }
    } catch {
      // Ignore quota errors or disabled localStorage
    }
    return InMemoryStorage.setItem(key, value);
  }

  static async removeItem(key: string): Promise<void> {
    try {
      if (typeof globalThis.localStorage?.removeItem === "function") {
        globalThis.localStorage.removeItem(key);
        return;
      }
    } catch {
      // Ignore errors
    }
    return InMemoryStorage.removeItem(key);
  }

  async getItem(key: string): Promise<string | null> {
    return LocalStorage.getItem(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    return LocalStorage.setItem(key, value);
  }

  async removeItem(key: string): Promise<void> {
    return LocalStorage.removeItem(key);
  }
}
