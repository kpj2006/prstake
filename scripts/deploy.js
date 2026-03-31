const hre = require("hardhat");
require("dotenv").config();

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const trustedAction = process.env.TRUSTED_ACTION_ADDRESS || deployer.address;

  console.log("Deploying with:", deployer.address);
  console.log("Trusted action:", trustedAction);

  const PRStakeVault = await hre.ethers.getContractFactory("PRStakeVault");
  const vault = await PRStakeVault.deploy(trustedAction);
  await vault.waitForDeployment();

  console.log("PRStakeVault:", await vault.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
