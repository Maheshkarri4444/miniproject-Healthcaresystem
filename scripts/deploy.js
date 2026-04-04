const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying contracts...");
  const Registry = await ethers.getContractFactory("DoctorRegistry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();


  const registryAddress = await registry.getAddress();

  console.log("DoctorRegistry deployed to:", await registry.getAddress());

  const NFT = await ethers.getContractFactory("MedicalAccessNFT");
  const nft = await NFT.deploy(registryAddress);
  await nft.waitForDeployment();

  console.log("MedicalAccessNFT deployed to:", await nft.getAddress());

  const Manager = await ethers.getContractFactory("HealthcareManager");
  const manager = await Manager.deploy(
    registryAddress,
    await nft.getAddress()
  );
  await manager.waitForDeployment();

  console.log("HealthcareManager deployed to:", await manager.getAddress());
}

// DoctorRegistry deployed to: 0x1596754054B7a730C7828c748c75fa137517451d
// MedicalAccessNFT deployed to: 0xe9fa980e25F3eAAB78406FDEf90B1C3CA44c3CD6
// HealthcareManager deployed to: 0x19038058bF30aeCdE2e5f4C1611818eB37e99aeb

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});