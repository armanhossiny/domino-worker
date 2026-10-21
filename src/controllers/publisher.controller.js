const logger = require("../utils/logger");
const { Queue } = require("bullmq");
const redisUtils = require("../utils/redis");


const WORKERS_KEY = "Domino:Workers";
const lockProcessPath = "Domino:InProcess:";
const matchEvents = [
  /*"acceptJoinMatch",
  "inviteRematch",
  "inviteFriendsToMatch",
  "invitePlayerToMatch",
  "declineJoinMatch",
  "inviteToMatch",
  "deleteFromMatch",*/
  "leaveMatch",
  "joinMatch"
];
const lockProcessEx = 15;

class publisher {
  workers = [];
  _queues = new Map();
  _queueConnection = null;

  async getWorkerList(){
    const cutoff = Date.now() - 60 * 1000;
    await redisUtils.getInstance().zRemRangeByScore(WORKERS_KEY, 0, cutoff);
    const workersList =
        await redisUtils.getInstance().zRange(WORKERS_KEY,0,-1) ;
    this.workers = [];
    for (const worker of workersList) {
      this.workers.push(worker);
    }
  }

  async getPidForJob(jobId) {
    try {
      return await redisUtils.getInstance().get(`${lockProcessPath}${jobId}`);
    } catch (error) {
      logger.error("Error getting PID for job:", error);
      return null;
    }
  }

  async lockProcess(key, pid) {
    try {
      await redisUtils.getInstance().set(`${lockProcessPath}${key}`, pid, { EX: lockProcessEx });
    } catch (error) {
      logger.error("Error locking process:", error);
    }
  }


  async sendJobToProcess(queueName, data) {
    try {
      let queue = null;
      if(this._queues.has(queueName)) {
        queue = this._queues.get(queueName);
      } else {
        queue = new Queue(queueName, {
          connection: this._queueConnection,
          prefix: `{${queueName}}`
        });
        this._queues.set(queueName, queue);

      }
      await queue.add(queueName, data);
    } catch (error) {
      logger.error("Error adding job to queue:", error);
      throw error;
    }
  }

  async connect(connection) {
    this._queueConnection = connection;
    await this.getWorkerList();
    setInterval(()=>this.getWorkerList(),30 * 1000);
  }

  async getReadyQueue(messageKey) {

    if(messageKey) {
      const existProcess = await this.getPidForJob(messageKey);
      if (existProcess) {
        return existProcess;
      }
    }

    if(this.workers.size === 0) {
      return null;
    }

    return  this.workers[Math.floor(Math.random() * this.workers.length)];
  }

  async insert(data) {

    const { payload, method } = data;
    const { gameId, query, key,roomId } = payload;

    let messageKey = gameId || roomId;

    if (method && matchEvents.includes(method)) {
      messageKey = key;
    }

    const queueName = await this.getReadyQueue(messageKey);

    if(queueName) {
      await this.sendJobToProcess(queueName, data);
      if (messageKey) {
        await this.lockProcess(messageKey, queueName);
      }
    }else{
      logger.error("no any worker to do jobs");
    }
  }
}
module.exports = new publisher();
