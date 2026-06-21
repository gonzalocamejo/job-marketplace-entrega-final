import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Desplegando con cuenta:", deployer.address);

  // 1. MockERC20
  const Token = await ethers.getContractFactory("MockERC20");
  const token = await Token.deploy("Job Token", "JTK", deployer.address);
  await token.waitForDeployment();
  const tokenAddr = await token.getAddress();
  console.log("MockERC20 desplegado en:", tokenAddr);

  // Mintear 10 000 tokens al deployer para pruebas
  await token.mint(deployer.address, ethers.parseUnits("10000", 18));
  console.log("10 000 JTK minteados al deployer");

  // 2. JobMarketplace
  const Market = await ethers.getContractFactory("JobMarketplace");
  const market = await Market.deploy(tokenAddr);
  await market.waitForDeployment();
  const marketAddr = await market.getAddress();
  console.log("JobMarketplace desplegado en:", marketAddr);

  // 3. Multisig de ejemplo
  const Multi = await ethers.getContractFactory("Multisig");
  const multisig = await Multi.deploy([deployer.address], 1n);
  await multisig.waitForDeployment();
  const multisigAddr = await multisig.getAddress();
  console.log("Multisig desplegado en:", multisigAddr);

  console.log("\n── Resumen ──────────────────────────────────────────");
  console.log(`ERC20_TOKEN_ADDRESS=${tokenAddr}`);
  console.log(`JOB_MARKETPLACE_ADDRESS=${marketAddr}`);
  console.log(`MULTISIG_ADDRESS=${multisigAddr}`);
  console.log("──────────────────────────────────────────────────────");
  console.log("\nCopia esas líneas a tu .env y al .env del frontend.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
