require("dotenv").config();
const ioredis = require('ioredis');

const process = require("process");

const logger = require("./utils/logger");
const redisUtils = require("./utils/redis");
const subscriber = require("./utils/SubscriberRedis");
const engine = require("./utils/engine");

const { server,workerQueue } = require("./config");

const {
  connectionMiddleware,
  exceptionHandler
} = require("./middleware");

const {
  subscriberController,
  onCloseController,
  onMessageController,
  publisherController
} = require("./controllers");
const {env} = require("process");


const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: process.env.REDIS_PORT || 6379,
  db: process.env.REDIS_DB || 0
};

function getQueueConnection(){
  const envNodes = process.env.BULL_REDIS_CLUSTER_NODES || `[{"host":"127.0.0.1","port":6379,"db":1}]`
  const nodes = JSON.parse(envNodes);

  const commonRedisOptions = {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      logger.warn(`Redis retry attempt ${times}, waiting ${delay}ms`);
      return delay;
    },
    reconnectOnError(err) {
      logger.error("Redis connection error:", err);
      return true;
    }
  };

  if(nodes.length > 1){
    return  new ioredis.Cluster(nodes, {
      scaleReads: 'master',
      enableReadyCheck: true,
      maxRedirections: 16,
      retryDelayOnFailover: 100,
      retryDelayOnClusterDown: 200,
      retryDelayOnTryAgain: 100,
      clusterRetryStrategy: (times) => {
        const delay = Math.min(times * 100, 3000);
        logger.warn(
            `[redis-cluster] retry #${times}, delay ${delay}ms`
        );
        return delay;
      },
      redisOptions: {
        ...commonRedisOptions,
        maxRetriesPerRequest: null,
      },
    });
  }

  return new ioredis(nodes[0],commonRedisOptions);
}

async function setupRedisUtils() {
  try {
    logger.info("Connecting to Redis...");

    const redisOptions = {
      database: REDIS_CONFIG.db,
      socket: {
        host: REDIS_CONFIG.host,
        port: REDIS_CONFIG.port,
        connectTimeout: 5000,
        reconnectStrategy: function(retries) {
          const delay = Math.min(retries * 50, 2000);
          console.warn(`Redis retry attempt ${retries}, waiting ${delay}ms`);
          return delay;
        }
      },
      disableOfflineQueue: false,
      commandsQueueMaxLength: 10000,
      pingInterval: 10000,
      name: workerQueue
    };
    await redisUtils.connect(redisOptions);

    logger.info("Redis connected successfully");
    logger.info(`Redis host: ${REDIS_CONFIG.host}`);
    logger.info(`Redis port: ${REDIS_CONFIG.port}`);
    logger.info(`Redis db: ${REDIS_CONFIG.db}`);

  } catch (error) {
    logger.error("Redis connection failed", error);
    process.exit(1);
  }
}


async function setupQueue() {
  try {
    logger.info("Connecting to Queue...");

    const connection  = getQueueConnection();
    await publisherController.connect(connection);

    logger.info("Redis connected successfully");

  } catch (error) {
    logger.error(error);
    process.exit(1);
  }

}

async function setupSubscriber() {
  try {
    logger.info("Connecting to Subscriber...");

    const connection = getQueueConnection();
    await subscriber.connect(subscriberController, connection);

    logger.info("Redis connected successfully");
    logger.info(`Redis host: ${REDIS_CONFIG.host}`);
    logger.info(`Redis port: ${REDIS_CONFIG.port}`);
    logger.info(`Redis db: ${REDIS_CONFIG.db}`);

  } catch (error) {
    logger.error("Redis connection failed", error);
    process.exit(1);
  }

}


async function checkRedisConnection() {
  try {
    await redisUtils.getInstance().ping();
    return true;
  } catch (error) {
    logger.error("Redis health check failed:", error);
    return false;
  }
}

function startRedisHealthMonitor() {
  setInterval(async () => {
    const healthy = await checkRedisConnection();

    if (!healthy) {
      logger.warn("Redis unhealthy. Reconnecting...");
      await setupRedisUtils();
    }
  }, 30000);
}


function startServer() {
  engine
    .use(connectionMiddleware)
    .on("error", onCloseController)
    .on("close", onCloseController)
    .on("message", onMessageController)
    .listen(server.port, () => {
      logger.info(`Worker running on port ${server.port}`);
    });
}


async function bootstrap() {
  logger.info("Starting Worker...");

  await setupRedisUtils();
  await setupQueue();
  await setupSubscriber();
  startServer();

  startRedisHealthMonitor();
}


async function gracefulShutdown(signal) {
  logger.info(`${signal} received. Shutting down...`);

  try {

    if (publisherController._queue) {
      await publisherController._queue.close();
    }

    if (subscriber.client) {
      await subscriber.client.disconnect();
    }

    if (redisUtils.client) {
      await redisUtils.client.disconnect();
    }

    logger.info("Shutdown completed");

  } catch (error) {
    logger.error("Shutdown error:", error);
    process.exit(1);
  }
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("uncaughtException", exceptionHandler);


bootstrap().then();
