const url = require("url");
const { clientController } = require("../controllers");

module.exports = async (connection) => {
  await clientController.init(connection);
};
