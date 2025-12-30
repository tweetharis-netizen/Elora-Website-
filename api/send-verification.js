const send = require("./verification/send");

module.exports = async function handler(req, res) {
  return send(req, res);
};
