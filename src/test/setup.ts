/**
 * Everything the app needs from a browser that jsdom does not provide.
 *
 * IndexedDB is the only one that is filled in: it is the app's source of truth,
 * so tests run against a working implementation rather than a mock of it. Audio,
 * vibration and the wake lock are all absent here, which is a state the app has
 * to handle on real devices anyway — every one of them is best effort.
 */
import 'fake-indexeddb/auto';
