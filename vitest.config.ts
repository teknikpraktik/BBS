import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Tests run against the real components and the real state machine. The only
 * thing stubbed anywhere is IndexedDB, and even that is a working in-memory
 * implementation rather than a mock of the app's own storage layer.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
