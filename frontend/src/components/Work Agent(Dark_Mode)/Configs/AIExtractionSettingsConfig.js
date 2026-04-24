
// Helper to format date as YYYY-MM-DD
export const formatDate = (date) => {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
};

// Helper to add days to a date
export const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

export const PRIORITIES = {
  urgent: { label: 'Urgent', color: 'red', bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' },
  high: { label: 'High', color: 'orange', bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' },
  medium: { label: 'Medium', color: 'yellow', bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300' },
  low: { label: 'Low', color: 'green', bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' },
  none: { label: 'None', color: 'gray', bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-300' },
};

// Date range preset options for extraction settings
export const DATE_RANGE_PRESETS = [
    { id: 'today', label: 'Today', getDates: () => ({ start: formatDate(new Date()), end: formatDate(new Date()) }) },
    { id: 'yesterday', label: 'Yesterday', getDates: () => ({ start: formatDate(addDays(new Date(), -1)), end: formatDate(addDays(new Date(), -1)) }) },
    { id: 'last_7_days', label: 'Last 7 days', getDates: () => ({ start: formatDate(addDays(new Date(), -7)), end: formatDate(new Date()) }) },
    { id: 'last_14_days', label: 'Last 14 days', getDates: () => ({ start: formatDate(addDays(new Date(), -14)), end: formatDate(new Date()) }) },
    { id: 'last_30_days', label: 'Last 30 days', getDates: () => ({ start: formatDate(addDays(new Date(), -30)), end: formatDate(new Date()) }) },
    { id: 'this_week', label: 'This week', getDates: () => {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const startOfWeek = addDays(now, -dayOfWeek);
      return { start: formatDate(startOfWeek), end: formatDate(now) };
    }},
    { id: 'custom', label: 'Custom range', getDates: () => null },
  ];