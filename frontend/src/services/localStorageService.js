// Purpose: LocalStorage adapter for persistent data across sessions.
// Parts: generic get/set with JSON serialization, typed accessors.

export const getData = (key, defaultValue = null) => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch (error) {
    console.error(`Failed to get data for key "${key}":`, error);
    return defaultValue;
  }
};

export const saveData = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Failed to save data for key "${key}":`, error);
  }
};

export const removeData = (key) => {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error(`Failed to remove data for key "${key}":`, error);
  }
};
