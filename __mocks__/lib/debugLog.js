/** Mock for lib/debugLog – no-op in tests */
module.exports = {
  debugLog: {
    info: () => {},
    warn: () => {},
    error: () => {},
    subscribe: () => () => {},
    getEntries: () => [],
    clearMemory: () => {},
    clearAll: async () => {},
    loadFromNative: async () => {},
  },
};
