import { describe, expect, it, beforeEach } from 'vitest';
import {
  loadSettings,
  loadMenu,
  loadSavedPromos,
} from './storage';

// In Node test environment, mock localStorage
class MockLocalStorage {
  private store = new Map<string, string>();
  getItem(key: string) {
    return this.store.get(key) || null;
  }
  setItem(key: string, val: string) {
    this.store.set(key, val);
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

const mockStorage = new MockLocalStorage();
if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = mockStorage;
}

describe('Storage smoke tests with corrupted / missing keys', () => {
  beforeEach(() => {
    mockStorage.clear();
  });

  it('Loads safe defaults on empty localStorage', () => {
    const settings = loadSettings();
    const menu = loadMenu();
    const promos = loadSavedPromos();

    expect(settings.platforms.grab.gpPercent).toBe(27);
    expect(menu.length).toBeGreaterThan(0);
    expect(promos.length).toBeGreaterThan(0);
  });

  it('Recovers gracefully from corrupted JSON in each storage key without throwing', () => {
    mockStorage.setItem('rest_promo_calc_settings_v1', '{{invalid json');
    mockStorage.setItem('rest_promo_calc_menu_v1', '[{"corrupt": true');
    mockStorage.setItem('rest_promo_calc_promos_v1', 'null');
    mockStorage.setItem('rest_promo_calc_analyzed_v1', 'undefined');

    expect(() => {
      const s = loadSettings();
      expect(s.platforms.grab).toBeDefined();
    }).not.toThrow();

    expect(() => {
      const m = loadMenu();
      expect(Array.isArray(m)).toBe(true);
      expect(m.length).toBeGreaterThan(0);
    }).not.toThrow();

    expect(() => {
      const p = loadSavedPromos();
      expect(Array.isArray(p)).toBe(true);
    }).not.toThrow();
  });
});
