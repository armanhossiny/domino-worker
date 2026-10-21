const publisherController = require("./publisher.controller");
const { ConnectionsModel } = require("../models");
const constants = require("../constants");
const PORT = process.env.PORT || 3000;
const { server } = require("../config");
const authenticateConnection = require("./authenticateConnection");


function parseConnectionQuery(payload) {
  const { extra } = payload;
  const url = new URL(`https://example.org${extra}`); //temp url

  const params = url.searchParams;
  payload.ver = Number(params.get("ver") || 0);
  payload.token = params.get("token") || "";
  payload.deviceId = params.get("deviceId") || "";
  payload.playerId = params.get("playerId") || "";
  payload.gameId = params.get("gameId") || "";
  payload.roomId = params.get("roomId") || "";
  payload.query = params.get("query") || "";
  payload.status = "online";
  return payload;
}

async function init(connection) {

  const playerPayload = await parseConnectionQuery(connection.extraData);
  const extra = connection.extraData;

  if(!playerPayload.playerId){
    connection.close();
    return;
  }

  let connectionId;
  try { connectionId = await authenticateConnection(playerPayload); }
  catch { connection.close(); return; }
  if (connection.connected === false) return;
  connection.authenticatedPlayerId = connectionId;
  // insert task to queue to run from core
  extra["connectionId"] = connectionId ;
  extra["queue"] = server.workerQueue;

  const task = {
    method: constants.method.connect,
    payload: extra,
    connectionId ,
  };

  connection.connectionId = connectionId;

  ConnectionsModel.add(connectionId, connection);
  try { await publisherController.insert(task); }
  catch (error) { connection.close(); throw error; }
}

function generateRandomString(length) {
  // Define characters allowed in the string
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    // Generate random index within character string length
    const randomIndex = Math.floor(Math.random() * characters.length);
    // Append the character at the random index to the result string
    result += characters.charAt(randomIndex);
  }
  return result;
}

module.exports = {
  init
};
