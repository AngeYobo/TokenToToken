const tokentotoken = artifacts.require("TokenFlashSwap");

module.exports = function (deployer) {
  deployer.deploy(tokentotoken);
};
