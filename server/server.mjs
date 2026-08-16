/**
 * Reference sync backend for BBS.
 *
 * Zero dependencies, JSON file storage. It exists to define and demonstrate the
 * contract the client expects; swap it for any implementation that honours the
 * same two routes.
 *
 *   PUT /workouts
 *     Body: a completed workout without sync_status. Upserts on workout_id, so
 *     replaying the same workout any number of times yields exactly one row.
 *     -> 200 { ok: true, created: boolean }
 *
 *   GET /workouts?installation_id=<id>
 *     -> 200 { workouts: [...] }
 *
 * There is no authentication and no account. A workout is associated with an
 * anonymous installation_id minted on the device, which is the whole identity
 * model: lose the device, lose the link.
 *
 *   node server/server.mjs            (PORT and DATA_FILE are configurable)
 */

import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 8787);
const DATA_FILE = process.env.DATA_FILE ?? join(HERE, 'data.json');

const NUMERIC_FIELDS = [
  'seated_row_kg',
  'chest_press_kg',
  'pulldown_kg',
  'overhead_press_kg',
  'leg_press_kg',
];

/** @type {Map<string, object>} */
let workouts = new Map();
let writing = Promise.resolve();

async function load() {
  try {
    const raw = await readFile(DATA_FILE, 'utf8');
    workouts = new Map(JSON.parse(raw).map((w) => [w.workout_id, w]));
  } catch {
    workouts = new Map();
  }
}

function persist() {
  // Serialised writes: concurrent upserts cannot interleave into a torn file.
  writing = writing.then(async () => {
    await mkdir(dirname(DATA_FILE), { recursive: true });
    await writeFile(DATA_FILE, JSON.stringify([...workouts.values()], null, 2));
  });
  return writing;
}

function send(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 64 * 1024) {
        reject(new Error('Body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/** @returns {string|null} an error message, or null when the workout is valid */
function validate(workout) {
  if (!workout || typeof workout !== 'object') return 'Body must be an object';
  if (typeof workout.workout_id !== 'string' || workout.workout_id.length < 8) {
    return 'workout_id must be a string';
  }
  if (typeof workout.installation_id !== 'string' || workout.installation_id.length < 8) {
    return 'installation_id must be a string';
  }
  if (typeof workout.completed_at !== 'string' || Number.isNaN(Date.parse(workout.completed_at))) {
    return 'completed_at must be an ISO 8601 instant';
  }
  for (const field of NUMERIC_FIELDS) {
    const value = workout[field];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1000) {
      return `${field} must be a number between 0 and 1000`;
    }
    // Weights only ever move in 2.5 kg steps.
    if (Math.abs(value / 2.5 - Math.round(value / 2.5)) > 1e-9) {
      return `${field} must be a multiple of 2.5`;
    }
  }
  return null;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  if (req.method === 'OPTIONS') return send(res, 204, {});

  if (req.method === 'GET' && url.pathname === '/health') {
    return send(res, 200, { ok: true, workouts: workouts.size });
  }

  if (req.method === 'GET' && url.pathname === '/workouts') {
    const installationId = url.searchParams.get('installation_id');
    if (!installationId) return send(res, 400, { error: 'installation_id is required' });
    const rows = [...workouts.values()]
      .filter((w) => w.installation_id === installationId)
      .sort((a, b) => b.completed_at.localeCompare(a.completed_at));
    return send(res, 200, { workouts: rows });
  }

  if (req.method === 'PUT' && url.pathname === '/workouts') {
    let parsed;
    try {
      parsed = JSON.parse(await readBody(req));
    } catch {
      return send(res, 400, { error: 'Invalid JSON' });
    }
    const problem = validate(parsed);
    if (problem) return send(res, 400, { error: problem });

    const created = !workouts.has(parsed.workout_id);
    const record = { ...parsed, received_at: new Date().toISOString() };
    // Upsert, not insert. Retrying a sync is expected and must stay harmless.
    workouts.set(parsed.workout_id, record);
    await persist();
    return send(res, 200, { ok: true, created });
  }

  send(res, 404, { error: 'Not found' });
});

await load();
server.listen(PORT, () => {
  console.log(`BBS sync backend on http://localhost:${PORT} (${workouts.size} workouts stored)`);
});
