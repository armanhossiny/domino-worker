const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const policy = require('../src/controllers/clientMessagePolicy');
const connection = { authenticatedPlayerId: 'alice', connectionId: 'alice' };

test('socket identity replaces forged player and server-owned middleware objects', () => {
  const input = { method: 'move', payload: { playerId: 'bob', connectionId: 'bob', queue: 'evil',
    player: { coins: 100 }, game: {}, profile: { isVip: true }, fromClient: false,
    isPlayerExistInMatch: true, gameTableInfo: { entryFee: 0 }, domino: 2 } };
  const result = policy(input, connection, 'gateway1');
  assert.deepEqual(result, { method: 'move', payload: {
    playerId: 'alice', connectionId: 'alice', queue: 'gateway1', domino: 2 } });
  assert.equal(input.payload.playerId, 'bob');
});

test('socket rejects internal commands, missing authentication and malformed payloads', () => {
  for (const method of ['connect', 'offline', 'disconnect', 'tick', 'QueueMessageCount',
    'create_match_system', 'removePlayerInMatch', 'move_leave_player', 'pickup_leave_player', 'changTurn']) {
    assert.throws(() => policy({ method, payload: {} }, connection, 'q'), /NOT_ALLOWED/);
  }
  assert.throws(() => policy({ method: 'move', payload: {} }, {}, 'q'), /NOT_AUTHENTICATED/);
  for (const payload of [null, [], 1, 'x']) {
    assert.throws(() => policy({ method: 'move', payload }, connection, 'q'), /INVALID_CLIENT_PAYLOAD/);
  }
});

test('gateway validates session with Parse before accepting claimed identity', async () => {
  const source = fs.readFileSync(path.join(root, 'src/controllers/authenticateConnection.js'), 'utf8');
  for (const [ok, id, accepts] of [[true, 'alice', true], [true, 'bob', false], [false, '', false]]) {
    const module = { exports: {} }, calls = [];
    vm.runInNewContext(source, { module, AbortSignal,
      process: { env: { PARSE_SERVER_URL: 'https://parse.invalid/parse/', APP_ID: 'app' } },
      fetch: async (...args) => { calls.push(args); return { ok, json: async () => ({ objectId: id }) }; }
    });
    const promise = module.exports({ token: 'synthetic-session', playerId: 'alice' });
    if (accepts) assert.equal(await promise, 'alice');
    else await assert.rejects(promise, /SESSION_/);
    assert.equal(calls[0][0], 'https://parse.invalid/parse/users/me');
    assert.equal(calls[0][1].redirect, 'error');
    assert.equal(calls[0][1].headers['X-Parse-Session-Token'], 'synthetic-session');
  }
});

test('authentication failure never registers or publishes a connection', async () => {
  const source = fs.readFileSync(path.join(root, 'src/controllers/client.controller.js'), 'utf8');
  const module = { exports: {} }, actions = [];
  const dependencies = {
    './authenticateConnection': async () => { throw Error('rejected'); },
    './publisher.controller': { insert: async () => actions.push('published') },
    '../models': { ConnectionsModel: { add: () => actions.push('registered') } },
    '../constants': { method: { connect: 'connect' } }, '../config': { server: { workerQueue: 'q' } }
  };
  vm.runInNewContext(source, { module, URL, process: { env: {} }, require: name => dependencies[name] });
  await module.exports.init({ extraData: { extra: '/?playerId=alice&token=fake' }, close: () => actions.push('closed') });
  assert.deepEqual(actions, ['closed']);
});

