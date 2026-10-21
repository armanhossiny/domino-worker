"use strict";
const methods = new Set([
  "checkOnline", "leaveGame", "report", "joinGame", "reJoinGame", "pickup", "move",
  "turnPass", "syncGame", "joinMatch", "joinClubMatch", "acceptJoinMatch",
  "inviteRematch", "inviteFriendsToMatch", "invitePlayerToMatch", "inviteToMatch",
  "declineJoinMatch", "deleteFromMatch", "leaveMatch", "joinRoom", "kickRoom",
  "leaveRoom", "showMessage", "sendStickerMessage", "getChatMessage",
  "sendChatMessage", "sendProvidedMessage", "sendMatchMessage"
]);
module.exports = function clientMessagePolicy(message, connection, queue) {
  if (!connection.authenticatedPlayerId) throw Error("SOCKET_NOT_AUTHENTICATED");
  if (!message || typeof message !== "object" || Array.isArray(message) || !methods.has(message.method))
    throw Error("CLIENT_METHOD_NOT_ALLOWED");
  if (!message.payload || typeof message.payload !== "object" || Array.isArray(message.payload))
    throw Error("INVALID_CLIENT_PAYLOAD");
  const payload = { ...message.payload };
  for (const key of ["player", "game", "room", "match", "profile", "fromClient", "token", "extra",
    "authenticatedPlayerId", "deleteFlag", "isPlayerExistInMatch", "gameTableInfo"]) delete payload[key];
  payload.playerId = connection.authenticatedPlayerId;
  payload.connectionId = connection.connectionId;
  payload.queue = queue;
  return { method: message.method, payload };
};
