import { ethers } from "hardhat";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

function repoPath(...segments: string[]) {
  return path.resolve(__dirname, "..", "..", "..", ...segments);
}

function updateFrontendAddress(managerAddress: string) {
  const configPath = repoPath("src", "config", "bettingContract.ts");
  const currentConfig = readFileSync(configPath, "utf8");

  const updatedConfig = currentConfig.replace(
    /(monadTestnet:\s*{[\s\S]*?typingBetManager:\s*")[^"]+(" as Address,)/,
    `$1${managerAddress}$2`
  );

  if (updatedConfig === currentConfig) {
    throw new Error(`Failed to update monadTestnet address in ${configPath}`);
  }

  writeFileSync(configPath, updatedConfig);
  return configPath;
}

async function main() {
  console.log("Deploying TypingBetManager to Monad Testnet...");

  const [deployer] = await ethers.getSigners();
  const provider = ethers.provider;
  const network = await provider.getNetwork();
  const balance = await provider.getBalance(deployer.address);

  console.log("Using account:", deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "MON");
  console.log("Network:", network.name, "Chain ID:", network.chainId.toString());

  const TypingBetManager = await ethers.getContractFactory("TypingBetManager");

  console.log("Submitting deployment transaction...");
  const manager = await TypingBetManager.deploy();
  const deployedContract = await manager.waitForDeployment();

  const managerAddress = await deployedContract.getAddress();
  const deployTx = deployedContract.deploymentTransaction();
  const artifactPath = repoPath("src", "contracts", "TypingBetManagerMonad.json");

  mkdirSync(path.dirname(artifactPath), { recursive: true });
  writeFileSync(
    artifactPath,
    JSON.stringify(
      {
        address: managerAddress,
        abi: JSON.parse(TypingBetManager.interface.formatJson()),
        network: network.name === "unknown" ? "monadTestnet" : network.name,
        chainId: Number(network.chainId),
        deployer: deployer.address,
        deployedAt: new Date().toISOString(),
        txHash: deployTx?.hash ?? null,
      },
      null,
      2
    )
  );

  const configPath = updateFrontendAddress(managerAddress);

  console.log("Deployment successful.");
  console.log("Contract:", managerAddress);
  console.log("Tx hash:", deployTx?.hash ?? "unknown");
  console.log("Artifact updated:", artifactPath);
  console.log("Frontend config updated:", configPath);
  console.log("Explorer:", `https://testnet.monadexplorer.com/address/${managerAddress}`);
  console.log("");
  console.log("Next:");
  console.log("1. Restart the frontend dev server if it is running.");
  console.log("2. Test create room, join room, start game, normal finish, and draw.");
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exit(1);
});
