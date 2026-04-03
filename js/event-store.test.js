const { EventStore, EventAPI } = require('./event-store');

describe('EventStore', () => {
  let store;

  beforeEach(() => {
    // Clear localStorage mock properly using jest-environment-jsdom
    window.localStorage.clear();

    // Setup fetch mock
    // Note: Node 20 / Jest 29 jsdom environment may not have global.fetch by default
    global.fetch = jest.fn();
    jest.spyOn(global, 'fetch').mockImplementation(jest.fn());

    // Instantiate fresh store
    store = new EventStore();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('loadEvents error handling', () => {
    it('should set loading to false and update error state when API fails', async () => {
      // Arrange: Mock fetch to simulate network error or failed API response
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      // Optionally, spy on console.error to keep test output clean
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Act: Trigger loadEvents
      await store.loadEvents();

      // Assert: Verify state transitions
      const state = store.getState();

      expect(state.loading).toBe(false);
      expect(state.error).toBe('Failed to load events. Please try again.');

      // We should also ensure the error was actually logged
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should handle network errors (fetch throws)', async () => {
      // Arrange: Mock fetch to throw a network error
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Act
      await store.loadEvents();

      // Assert
      const state = store.getState();
      expect(state.loading).toBe(false);
      expect(state.error).toBe('Failed to load events. Please try again.');
    });
  });
});
