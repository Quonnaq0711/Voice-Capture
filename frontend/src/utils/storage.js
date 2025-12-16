/**
 * Safe localStorage wrapper that handles private browsing mode and exceptions.
 *
 * In private browsing mode or when localStorage is disabled, operations
 * will fail silently and return null/false instead of throwing exceptions.
 */

/**
 * Safely get an item from localStorage.
 * @param {string} key - The key to retrieve
 * @param {*} defaultValue - Default value if key doesn't exist or storage fails
 * @returns {*} The stored value, defaultValue, or null
 */
export const getItem = (key, defaultValue = null) => {
  try {
    const item = localStorage.getItem(key);
    return item !== null ? item : defaultValue;
  } catch (error) {
    console.warn(`Failed to get localStorage item "${key}":`, error.message);
    return defaultValue;
  }
};

/**
 * Safely set an item in localStorage.
 * @param {string} key - The key to set
 * @param {string} value - The value to store
 * @returns {boolean} True if successful, false otherwise
 */
export const setItem = (key, value) => {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.warn(`Failed to set localStorage item "${key}":`, error.message);
    return false;
  }
};

/**
 * Safely remove an item from localStorage.
 * @param {string} key - The key to remove
 * @returns {boolean} True if successful, false otherwise
 */
export const removeItem = (key) => {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.warn(`Failed to remove localStorage item "${key}":`, error.message);
    return false;
  }
};

/**
 * Safely get a JSON-parsed item from localStorage.
 * @param {string} key - The key to retrieve
 * @param {*} defaultValue - Default value if key doesn't exist or parsing fails
 * @returns {*} The parsed value or defaultValue
 */
export const getJSON = (key, defaultValue = null) => {
  try {
    const item = localStorage.getItem(key);
    if (item === null) return defaultValue;
    return JSON.parse(item);
  } catch (error) {
    console.warn(`Failed to get/parse localStorage item "${key}":`, error.message);
    return defaultValue;
  }
};

/**
 * Safely set a JSON-stringified item in localStorage.
 * @param {string} key - The key to set
 * @param {*} value - The value to stringify and store
 * @returns {boolean} True if successful, false otherwise
 */
export const setJSON = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(`Failed to set localStorage item "${key}":`, error.message);
    return false;
  }
};

/**
 * Check if localStorage is available.
 * @returns {boolean} True if localStorage is available and working
 */
export const isAvailable = () => {
  try {
    const testKey = '__storage_test__';
    localStorage.setItem(testKey, testKey);
    localStorage.removeItem(testKey);
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Safely clear all localStorage items.
 * @returns {boolean} True if successful, false otherwise
 */
export const clear = () => {
  try {
    localStorage.clear();
    return true;
  } catch (error) {
    console.warn('Failed to clear localStorage:', error.message);
    return false;
  }
};

export default {
  getItem,
  setItem,
  removeItem,
  getJSON,
  setJSON,
  isAvailable,
  clear,
};
