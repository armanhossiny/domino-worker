const publisher = require("./publisher.controller");
const logger = require("../utils/logger");
const { ConnectionsModel } = require("../models");
const { server } = require("../config");
const clientMessagePolicy = require("./clientMessagePolicy");


module.exports = async (message, connection) => {
  connection.lastActivityAt = Date.now();
  try {
    const con = ConnectionsModel.get(connection.connectionId);
    if(con !== connection || !connection.authenticatedPlayerId){
      return;
    }
    if (typeof message.utf8Data !== "string" || Buffer.byteLength(message.utf8Data, "utf8") > 65536)
      throw Error("INVALID_MESSAGE_SIZE");
    const msg = JSON.parse(message.utf8Data);
    if (msg === 4) {
      if(con){
        con.send("5");
      }

      const lasOnline = connection.lastOnlineCheck;
      if(!lasOnline ||   Date.now() - lasOnline > (1000 * 50)){
        connection.lastOnlineCheck = Date.now();
        const onlineMethod = {
          method: "userOnline",
          payload:{
            playerId: connection.connectionId,
            connectionId : connection.connectionId,
            queue : server.workerQueue
          }
        }
        await publisher.insert(onlineMethod);
      }
      return;
    }

    if (msg?.method === "ping") {
      // use at old versions need to remove
      const { method, payload } = msg;
      connection.send(JSON.stringify({ method, payload }));
      return;
    }

    if (
      connection.lastMessageTime &&
      Date.now() - connection.lastMessageTime < 100
    ) {
      logger.info(`rate limit:${Date.now() - connection.lastMessageTime}  method:${msg.method}  last:${connection.lastMethod}`);
      //return;
    }
    connection.lastMethod = msg.method;
    connection.lastMessageTime = Date.now();

    await publisher.insert(clientMessagePolicy(msg, connection, server.workerQueue));
  } catch (e) {
    logger.warn({ event: "CLIENT_MESSAGE_REJECTED", connectionId: connection.connectionId });
  }
};
