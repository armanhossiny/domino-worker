const logger = require("../utils/logger");
const CONECTIONS_LOOP_CHECK_TIME = 10000;
const CONECTION_TIMEOUT = 1000 * 60 * 10;

class ConnectionManager {
  constructor() {
    //super();
    this.Connections = new Map();
    setInterval(async()=> this.cleaner(),CONECTIONS_LOOP_CHECK_TIME);
  }

  add(playerId, connection) {
    logger.info(`${process.pid} connections size: ${this.Connections.size + 1}`);
    return !!this.Connections.set(playerId, connection);
  }

  delete(playerId) {
    this.Connections.delete(playerId);
  }

  get(playerId) {
    return playerId ? this.Connections.get(playerId) : undefined;
  }

  count() {
    return this.Connections.size;
  }

  update(playerId, status) {
    const client = this.get(playerId);
    if (client) {
      Object.assign(client, { status });
      this.Connections.set(playerId, client);
    }
    return client;
  }

  cleaner(){
    for(const ws of this.Connections.values()){
      if(!ws.lastActivityAt){
        ws.lastActivityAt = Date.now();
      }
      if (ws.lastActivityAt <= Date.now() - CONECTION_TIMEOUT) {
        ws.closeReasonCode = "IDLE_TIMEOUT";
        ws.close();
        // The close handler owns removal and offline publication. Deleting
        // here races with asynchronous close and with replacement sockets.
      }
    }
  }
}

module.exports = new ConnectionManager();

