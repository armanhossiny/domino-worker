const { ConnectionsModel } = require("../models");

module.exports = async (job) => {
  try {
    const { playerId, payload } = job.data;
    const connection = ConnectionsModel.get(playerId);
    if (connection && connection.state === "open" ) {
      connection.send(JSON.stringify(payload));
    }
  } catch (err) {
    this.log("Try Catch Worker (message):", { err });
  }
};
