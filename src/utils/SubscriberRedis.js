const { Worker } = require("bullmq");
const { server } = require("../config");

class SubscriberRedis {
  constructor() {
  }

  /**
   * try to connect
   */
  async connect(jobProcessor, connection) {
    this.worker = new Worker(
      server.workerQueue,
      async (job) => {
        jobProcessor(job);
      },
      {
        connection,
        prefix: `{${server.workerQueue}}`,
        concurrency: 100,
        removeOnComplete: { count: 0 },
        removeOnFail: { count: 50 }
      }
    );
  }
}

module.exports = new SubscriberRedis();
