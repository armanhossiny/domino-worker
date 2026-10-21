// Local regression tests. No Redis, SDK, sockets or production services.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');

function setup() {
  const events = [], jobs = [];
  const logger = Object.fromEntries(['info', 'debug', 'warn', 'error'].map(level =>
    [level, value => events.push({ level, value })]));
  function load(file, dependencies) {
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.join(root, file), 'utf8'), {
      module, process: { pid: 1 }, setInterval() {},
      require(name) {
        if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
        return dependencies[name];
      }
    }, { filename: file });
    return module.exports;
  }
  const model = load('src/models/connections.model.js', {
    '../utils/logger': logger
  });
  const close = load('src/controllers/onClose.controller.js', {
    '../models': { ConnectionsModel: model },
    './publisher.controller': { insert: async job => jobs.push(job) },
    '../utils/logger': logger
  });
  const socket = () => ({ connectionId: 'test-player', extraData: {
    playerId: 'test-player', gameId: 'test-game', roomId: 'test-room',
    token: 'secret-test-token', extra: '?token=secret-test-token'
  } });
  return { model, close, socket, events, jobs };
}

test('late close preserves replacement connection and emits no offline job', async () => {
  const { model, close, socket, jobs } = setup();
  const old = socket(), fresh = socket();
  model.add(old.connectionId, old);
  model.add(fresh.connectionId, fresh);
  await close(1000, old);
  assert.equal(model.get(fresh.connectionId), fresh);
  assert.equal(jobs.length, 0);
});

test('current connection closes once even if error and close both arrive', async () => {
  const { model, close, socket, jobs, events } = setup();
  const current = socket();
  model.add(current.connectionId, current);
  await close(1006, current);
  await close(1006, current);
  assert.equal(model.count(), 0);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].method, 'offline');
  assert.equal(JSON.stringify(events).includes('secret-test-token'), false);
});

test('delayed idle close still publishes offline exactly once', async () => {
  const { model, close, socket, jobs, events } = setup();
  const current = socket();
  current.lastActivityAt = Date.now() - 11 * 60 * 1000;
  let requested = false;
  current.close = () => { requested = true; };
  model.add(current.connectionId, current);
  model.cleaner();
  assert.equal(requested, true);
  await close(1000, current);
  assert.equal(model.count(), 0);
  assert.equal(jobs.length, 1);
  assert.equal(events.some(item => item.value.reasonCode === 'IDLE_TIMEOUT'), true);
});

test('replacement during idle close is not removed by cleaner', () => {
  const { model, socket } = setup();
  const old = socket(), fresh = socket();
  old.lastActivityAt = Date.now() - 11 * 60 * 1000;
  old.close = () => model.add(fresh.connectionId, fresh);
  model.add(old.connectionId, old);
  model.cleaner();
  assert.equal(model.get(fresh.connectionId), fresh);
});

test('unregistered connection cannot publish offline for a player', async () => {
  const { close, socket, jobs } = setup();
  await close(1000, socket());
  assert.equal(jobs.length, 0);
});

