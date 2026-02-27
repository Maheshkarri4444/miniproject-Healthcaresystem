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

// DoctorRegistry deployed to: 0xF9fcf870Ae8F603bC6736f5C528618bfA357353d
// MedicalAccessNFT deployed to: 0x93ED10C80120aAF7263567246Dc3D467DafE9fA6
// HealthcareManager deployed to: 0x9011138e38BDb9a6D51E00913cDdf9F533d2742E

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});