const os = require("os");
const ProcessId = process.env.pm_id || "develop";
const host = os.hostname();
const workerQueue = `worker_${host}_${ProcessId}`;
module.exports = {
  server: {
    port: process.env.PORT,
    channel: "workerChannel",
    workerQueue
  },
};
