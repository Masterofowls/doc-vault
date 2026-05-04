/** Mock for lib/database — just the functions offline.ts uses */
const updateBookmarkCache = jest.fn().mockResolvedValue(undefined);
module.exports = { updateBookmarkCache };
