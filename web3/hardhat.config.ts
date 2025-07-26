import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config(); 

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      metadata: {
        bytecodeHash: "none",
        useLiteralContent: true, 
      },
    },
  },
  networks: {
    monadTestnet: {
      url: "https://testnet-rpc.monad.xyz",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 10143,
      timeout: 60000, // ✅ Add timeout
      gas: "auto",     // ✅ Auto gas estimation
      gasPrice: "auto" // ✅ Auto gas price
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337
    },
  },
  etherscan: {
    customChains: [
      {
        network: "monadTestnet",
        chainId: 10143,
        urls: {
          apiURL: "https://testnet.monadexplorer.com/api",
          browserURL: "https://testnet.monadexplorer.com",
        },
      },
    ],
  },
  sourcify: {
    enabled: true
  }
};

export default config;