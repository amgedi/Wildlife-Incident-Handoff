import { beforeEach, afterEach, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { resetDbForTests } from "../storage/db";
import "fake-indexeddb/auto";

// jsdom lacks matchMedia. Plain function (not vi.fn) — vi.restoreAllMocks()
// in afterEach would strip a mock's implementation and break later tests.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

beforeEach(async () => {
  // Fresh IndexedDB per test to isolate storage.
  await resetDbForTests();
  indexedDB = new IDBFactory();
});

afterEach(() => {
  vi.restoreAllMocks();
});
