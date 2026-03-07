const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying contracts...");

  const Registry = await ethers.getContractFactory("DoctorRegistry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();

  console.log("DoctorRegistry deployed to:", await registry.getAddress());

  const NFT = await ethers.getContractFactory("MedicalAccessNFT");
  const nft = await NFT.deploy(await registry.getAddress());
  await nft.waitForDeployment();

  console.log("MedicalAccessNFT deployed to:", await nft.getAddress());

  const Manager = await ethers.getContractFactory("HealthcareManager");
  const manager = await Manager.deploy(
    await registry.getAddress(),
    await nft.getAddress()
  );
  await manager.waitForDeployment();

  console.log("HealthcareManager deployed to:", await manager.getAddress());
}

// DoctorRegistry deployed to: 0x5FbDB2315678afecb367f032d93F642f64180aa3
// MedicalAccessNFT deployed to: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
// HealthcareManager deployed to: 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});