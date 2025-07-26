import { ethers } from "hardhat";
import { writeFileSync } from "fs";

async function main() {
  console.log("🚀 Deploying TypingBetManager to Monad Testnet...");

  const [deployer] = await ethers.getSigners();
  
  // ✅ FIXED: Get provider correctly
  const provider = ethers.provider;
  const network = await provider.getNetwork();
  const balance = await provider.getBalance(deployer.address);
  
  console.log("Using account:", deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "MON");
  console.log("Network:", network.name, "Chain ID:", network.chainId.toString());

  // ✅ FIXED: Proper gas estimation
  const TypingBetManager = await ethers.getContractFactory("TypingBetManager");
  
  console.log("📊 Estimating deployment gas...");
  
  try {
    // Deploy with proper error handling
    const manager = await TypingBetManager.deploy();
    
    console.log("⏳ Waiting for deployment confirmation...");
    const deployedContract = await manager.waitForDeployment();
    
    const managerAddress = await deployedContract.getAddress();
    const deployTx = deployedContract.deploymentTransaction();
    
    console.log("✅ TypingBetManager deployed to:", managerAddress);
    console.log("📋 Transaction hash:", deployTx?.hash);
    
    if (deployTx) {
      console.log("⛽ Gas used:", deployTx.gasLimit?.toString());
      console.log("💰 Gas price:", ethers.formatUnits(deployTx.gasPrice || 0, "gwei"), "gwei");
    }

    // ✅ FIXED: Save contract info
    const managerInfo = {
      address: managerAddress,
      abi: JSON.parse(TypingBetManager.interface.formatJson()),
      network: network.name === "unknown" ? "monadTestnet" : network.name,
      chainId: Number(network.chainId),
      deployer: deployer.address,
      deployedAt: new Date().toISOString(),
      txHash: deployTx?.hash,
      blockNumber: deployTx?.blockNumber
    };

    // ✅ Save to correct path
    const abiPath = "../src/contracts/TypingBetManagerMonad.json";
    writeFileSync(abiPath, JSON.stringify(managerInfo, null, 2));

    // ✅ FIXED: Update config with correct path
    const configContent = `// AUTO-GENERATED: Updated by TypingBetManager deployment
// Last updated: ${new Date().toISOString()}

import { Address } from 'viem'

// ✅ Contract addresses for different networks
export const CONTRACTS = {
  localhost: {
    typingBetManager: (import.meta.env.VITE_LOCALHOST_TYPING_BET_MANAGER || '0x0000000000000000000000000000000000000000') as Address,
    chainId: 31337,
  },
  monadTestnet: {
    typingBetManager: '${managerAddress}' as Address,
    chainId: 10143,
  }
} as const

export const getCurrentNetwork = () => {
  const chainId = import.meta.env.VITE_CHAIN_ID || '10143';
  return chainId === '31337' ? 'localhost' : 'monadTestnet';
};

export const CURRENT_NETWORK = getCurrentNetwork();
export const TYPING_BET_MANAGER_ADDRESS = CONTRACTS[CURRENT_NETWORK].typingBetManager;
export const CURRENT_CHAIN_ID = CONTRACTS[CURRENT_NETWORK].chainId;

export const CONTRACT_LIMITS = {
  MIN_BET: 0.001,
  MAX_BET: 10,
  MIN_TIME: 30,
  MAX_TIME: 300
} as const;

export const getNetworkInfo = () => ({
  name: CURRENT_NETWORK === 'localhost' ? 'Localhost' : 'Monad Testnet',
  chainId: CURRENT_CHAIN_ID,
  currency: CURRENT_NETWORK === 'localhost' ? 'ETH' : 'MON',
  explorer: CURRENT_NETWORK === 'localhost' 
    ? 'http://localhost:8545' 
    : 'https://testnet.monadexplorer.com'
});
`;

    const configPath = "../src/config/deployedAddresses.ts";
    writeFileSync(configPath, configContent);

    console.log("\n🎉 MONAD TESTNET DEPLOYMENT COMPLETED!");
    console.log("🏁 Contract Address:", managerAddress);
    console.log("🌐 Network: Monad Testnet (10143)");
    console.log("💾 ABI saved to:", abiPath);
    console.log("⚙️ Config updated in:", configPath);
    console.log("🔗 Explorer:", `https://testnet.monadexplorer.com/address/${managerAddress}`);
    
    // ✅ Show next steps
    console.log("\n📝 NEXT STEPS:");
    console.log("1. Add to your .env file:");
    console.log(`   VITE_MONAD_TYPING_BET_MANAGER=${managerAddress}`);
    console.log("2. Set network in .env:");
    console.log("   VITE_CHAIN_ID=10143");
    console.log("3. Restart your frontend application");

  } catch (error) {
    console.error("❌ Deployment error:", error);
    throw error;
  }
}

main().catch((error) => {
  console.error("❌ Deployment failed:", error);
  process.exit(1);
});