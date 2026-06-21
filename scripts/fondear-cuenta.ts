import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const target = process.env.FONDEAR_WALLET;
  if (!target) throw new Error("Definí FONDEAR_WALLET en .env");

  const tx = await deployer.sendTransaction({
    to: target,
    value: ethers.parseEther("10"),
  });
  await tx.wait();
  console.log("Enviados 10 ETH a", target);

  const token = await ethers.getContractAt(
    "MockERC20",
    "0x5FbDB2315678afecb367f032d93F642f64180aa3"
  );
  const mintTx = await token.mint(target, ethers.parseUnits("1000", 18));
  await mintTx.wait();
  console.log("Minteados 1000 JTK a", target);
}

main().catch(console.error);
