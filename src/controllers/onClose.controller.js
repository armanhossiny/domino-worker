const { ConnectionsModel } = require("../models");
const publisher = require("./publisher.controller");
const logger = require("../utils/logger");

module.exports = async (client, connection) => {
  const { connectionId } = connection;
  // A late error/close from an old socket must not remove its replacement
  // or publish an offline event for the currently connected player.
  if (ConnectionsModel.get(connectionId) !== connection) {
    logger.debug({ event: "connection_close_ignored", reasonCode: "STALE_SOCKET", connectionId });
    return;
  }

  ConnectionsModel.delete(connectionId);
  logger.info({
    event: "connection_closed",
    reasonCode: connection.closeReasonCode || (Number.isInteger(client) ? "SOCKET_CLOSE" : "SOCKET_ERROR"),
    closeCode: Number.isInteger(client) ? client : null,
    connectionId,
    gameId: connection.extraData?.gameId || null,
    roomId: connection.extraData?.roomId || null
  });

  if (connection?.extraData) {
    if (!connection?.extraData?.deleteFlag) {
      Object.assign(connection.extraData, { deleteFlag: true })

      const payload = {
        method: "offline",
        payload: connection.extraData,
      };
      await publisher.insert(payload);


      // const payload = {
      //     method: "disconnect",
      //     payload: connection.extraData,
      // };
      // await publisher.insert(payload);
    }
  }
};
