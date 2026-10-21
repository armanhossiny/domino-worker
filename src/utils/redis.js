const { createClient } = require("redis");
const logger = require("./logger")

class RedisUtils {
  constructor() {
    this.client = null;
  }


  async connect(config) {
    this.client = createClient(config);
    logger.info(config);
    this.client.on("error", (err) => logger.error(`Redis Client Error ${err} `));
    await this.client.connect();
  }

  /**
     *
     * @returns redis client instance
     */
  getInstance() {
    return this.client;
  }
}

module.exports = new RedisUtils();
