# Worker tests

From this repository root, run `npm.cmd test` (or `npm test` on Linux).

All 9 tests load this repository's code with injected network and queue
boundaries. They cover replacement connections, close/idle races, authenticated
identity, client method restrictions and authentication failure. No sibling
checkout, credentials or running services are required. Real WebSocket/Parse
integration remains a separate staging check.
