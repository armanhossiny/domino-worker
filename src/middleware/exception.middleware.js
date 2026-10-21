const fs = require("fs");
const logger = require("../utils/logger")

module.exports = (err) => {
  logger.error(err);
  const error = err.message + "\n" + err.stack + "\n";
  const date = new Date();
  const strDate = date.getFullYear() + "_" + date.getMonth() + "_" + date.getDay();
  fs.appendFile(
    "./log/ErrorLog_" + strDate + ".log",
    error,
    "utf8",
    (errorFile) => {
      if (errorFile) { throw errorFile; }
      logger.error("Saved error log file!");
    }
  );
};
