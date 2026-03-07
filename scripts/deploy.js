const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying contracts...");
  const registryAddress = "0xAdb09eC2d071296f847DdbDC4abFae55A1Cbc911";

  // const Registry = await ethers.getContractFactory("DoctorRegistry");
  // const registry = await Registry.deploy();
  // await registry.waitForDeployment();

  // console.log("DoctorRegistry deployed to:", await registry.getAddress());

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

// DoctorRegistry deployed to: 0xAdb09eC2d071296f847DdbDC4abFae55A1Cbc911
// MedicalAccessNFT deployed to: 0x85F624F492f7965af3542a9858247e7612319b05
// HealthcareManager deployed to: 0xEEe28039DcC01b4672a3eCadA9BccBe31372bb4E

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});