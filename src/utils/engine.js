const websocket = require("websocket");
const http = require("http");
const { getConnectionExtraData } = require("../controllers/client.controller");
const websocketServer = websocket.server;
const logger = require("./logger");

class Engine {
  constructor() {
    this.midllewares = [];
    this.handlers = new Map();
    this.httpServer = http.createServer();
    this.wsServer = null;
  }

  eventHandler(endpoint, meta, connection) {
    for (const [path, callback] of this.handlers) {
      if (path === endpoint) {
        callback(meta, connection);
        break;
      }
    }
  }

  listen(port, callback) {
    this.httpServer.listen(port, () => {
      this.wsServer = new websocketServer({
        httpServer: this.httpServer
      });

      // Error handler for WebSocket server
      this.wsServer.on("error", (error) => {
        logger.error("WebSocket Server Error:", error);
        process.exit(1);
      });

      this.run();

      callback();
    });
  }

  middlewareHandler(connection) {
    if (this.midllewares.length > 0) {
      this.midllewares[0](connection);
    }
  }

  on(endpoint, callback) {
    this.handlers.set(endpoint, callback);
    return this;
  }

  run() {
    this.wsServer.on("request", (request) => {
      const connection = request.accept(null, request.origin);
      connection.extraData = {
        extra: request.resource
      };

      // on connection open
      connection.on("open", (client) => {
        logger.debug("Engine : (open)");
        this.eventHandler("open", client, connection);
      });

      // on connection upgrade
      connection.on("upgrade", (client) => {
        logger.debug("Engine : (upgrade)", client);
        this.eventHandler("upgrade", client, connection);
      });

      // on connection close
      connection.on("close", (client) => {
        logger.debug("Engine : (close)", client);
        this.eventHandler("close", client, connection);
      });

      // on connection error
      connection.on("error", (error) => {
        logger.error(`Engine : (error) ${error}`);
        this.eventHandler("error", error, connection);
      });

      // on restive every message
      connection.on("message", (message) => {
        // call on message event
        this.eventHandler("message", message, connection);
      });

      this.middlewareHandler(connection);
    });
  }

  use(callback) {
    this.midllewares.push(callback);
    return this;
  }
}

module.exports = new Engine();
