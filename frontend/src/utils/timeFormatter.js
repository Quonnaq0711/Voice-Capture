/**
 * Unified time formatting utilities
 * All timestamps from backend are in UTC (ISO 8601 format)
 * These functions ensure consistent timezone handling across the app
 */

/**
 * Normalize timestamp to ensure it's treated as UTC
 * @param {string|number} timestamp - ISO string or timestamp in milliseconds
 * @returns {Date} Date object representing the UTC time
 */
const normalizeTimestamp = (timestamp) => {
  if (!timestamp) return null;

  // If it's a number (milliseconds), create Date directly
  if (typeof timestamp === 'number') {
    return new Date(timestamp);
  }

  // If it's a string, check if it's an ISO string without timezone
  if (typeof timestamp === 'string') {
    // If the string doesn't end with 'Z' or contain timezone offset ('+' or '-' followed by time)
    // then it's likely a timezone-naive ISO string from backend (SQLite), treat as UTC
    if (!timestamp.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(timestamp)) {
      // Add 'Z' to indicate UTC
      return new Date(timestamp + 'Z');
    }
  }

  // Otherwise, parse as-is
  return new Date(timestamp);
};

/**
 * Get user timezone from browser
 * @returns {string} IANA timezone identifier (e.g., "America/New_York")
 */
const getUserTimezone = () => {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
};

/**
 * Format timestamp to display time with timezone (user timezone)
 * @param {string|number} timestamp - ISO string or timestamp in milliseconds
 * @returns {string} Formatted time string with timezone (e.g., "2:04 PM EST")
 */
export const formatTime = (timestamp) => {
  if (!timestamp) return '';

  const date = normalizeTimestamp(timestamp);
  if (!date) return '';

  return new Intl.DateTimeFormat('en-US', {
    timeZone: getUserTimezone(),
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short'
  }).format(date);
};

/**
 * Format timestamp to display date in MM/DD/YYYY format
 * @param {string|number} timestamp - ISO string or timestamp in milliseconds
 * @returns {string} Formatted date string (e.g., "11/24/2025")
 */
export const formatDate = (timestamp) => {
  if (!timestamp) return '';

  const date = normalizeTimestamp(timestamp);
  if (!date) return '';

  return new Intl.DateTimeFormat('en-US', {
    timeZone: getUserTimezone(),
    month: 'numeric',
    day: 'numeric',
    year: 'numeric'
  }).format(date);
};

/**
 * Format timestamp to display full date and time with timezone (users timezone)
 * @param {string|number} timestamp - ISO string or timestamp in milliseconds
 * @returns {string} Formatted datetime string (e.g., "11/24/2025, 2:04 PM UTC")
 */
export const formatDateTime = (timestamp) => {
  if (!timestamp) return '';

  const date = normalizeTimestamp(timestamp);
  if (!date) return '';

  return new Intl.DateTimeFormat('en-US', {
    timeZone: getUserTimezone(),
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short'
  }).format(date);
};

/**
 * Format timestamp relative to now (e.g., "2 hours ago", "Just now")
 * @param {string|number} timestamp - ISO string or timestamp in milliseconds
 * @returns {string} Relative time string
 */
export const formatRelativeTime = (timestamp) => {
  if (!timestamp) return '';

  const date = normalizeTimestamp(timestamp);
  if (!date) return '';

  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return formatDate(timestamp);
};

/**
 * Get timezone abbreviation
 * @returns {string} Timezone abbreviation (e.g., "UTC", "EST", "PST")
 */
export const getTimezoneAbbr = () => {
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone: getUserTimezone(),
    timeZoneName: 'short'
  }).format(new Date());

  const match = formatted.match(/([A-Z]{3,5})$/);
  return match ? match[1] : getUserTimezone();
};
