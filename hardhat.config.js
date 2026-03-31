require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const RPC_URL = process.env.RPC_URL || "";
const hasValidPrivateKey = /^0x[0-9a-fA-F]{64}$/.test(PRIVATE_KEY);

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.24",
  networks: {
    rootstockTestnet: {
      url: RPC_URL,
      chainId: 31,
      accounts: hasValidPrivateKey ? [PRIVATE_KEY] : []
    }
  }
};
