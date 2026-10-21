const method = "ping";
module.exports = async (payload, connection) => {
  connection.send(JSON.stringify({ method, payload }));
};
