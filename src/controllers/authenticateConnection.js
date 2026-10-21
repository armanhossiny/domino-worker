"use strict";
module.exports = async function authenticateConnection({ token, playerId }) {
  const { PARSE_SERVER_URL, APP_ID, PARSE_REST_API_KEY } = process.env;
  if (!PARSE_SERVER_URL || !APP_ID) throw Error("SESSION_CONFIGURATION_REQUIRED");
  if (!token || !playerId) throw Error("SESSION_REQUIRED");
  const headers = { "X-Parse-Application-Id": APP_ID, "X-Parse-Session-Token": token };
  if (PARSE_REST_API_KEY) headers["X-Parse-REST-API-Key"] = PARSE_REST_API_KEY;
  const response = await fetch(PARSE_SERVER_URL.replace(/\/$/, "") + "/users/me", {
    headers, redirect: "error", signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw Error("SESSION_REJECTED");
  const user = await response.json();
  if (!user?.objectId || user.objectId !== playerId) throw Error("SESSION_IDENTITY_MISMATCH");
  return user.objectId;
};
