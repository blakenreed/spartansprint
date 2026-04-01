// src/storage.js — localStorage wrapper for persistent app state

export const storage = {
  save: (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.error(`Failed to save ${key}:`, err);
    }
  },

  load: (key) => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (err) {
      console.error(`Failed to load ${key}:`, err);
      return null;
    }
  },

  clear: (key) => {
    try {
      localStorage.removeItem(key);
    } catch (err) {
      console.error(`Failed to clear ${key}:`, err);
    }
  },

  clearAll: () => {
    try {
      localStorage.clear();
    } catch (err) {
      console.error("Failed to clear localStorage:", err);
    }
  },
};
