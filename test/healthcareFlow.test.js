const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Healthcare System Full Flow", function () {
  let admin, user, doctor;
  let registry, nft, manager;

  const DOCTOR_CERT_IPFS = "QmDoctorCertificateHash123";
  const MEDICAL_FILE_IPFS = "QmEncryptedMedicalFileHash456";

  before(async () => {
    [admin, user, doctor] = await ethers.getSigners();
  });

  it("Deploy contracts", async () => {
    const Registry = await ethers.getContractFactory("DoctorRegistry");
    registry = await Registry.deploy();
    await registry.waitForDeployment();

    const NFT = await ethers.getContractFactory("MedicalAccessNFT");
    nft = await NFT.deploy();
    await nft.waitForDeployment();

    const Manager = await ethers.getContractFactory("HealthcareManager");
    manager = await Manager.deploy(
      await registry.getAddress(),
      await nft.getAddress()
    );
    await manager.waitForDeployment();
  });

  it("Doctor registers and admin verifies", async () => {
    await registry.connect(doctor).registerDoctor(DOCTOR_CERT_IPFS);
    await registry.verifyDoctor(doctor.address);

    expect(await registry.isDoctorVerified(doctor.address)).to.equal(true);
  });

  it("User grants access using NFT", async () => {
    const encryptedAESKey = ethers.toUtf8Bytes("ENCRYPTED_AES_KEY");

    const tx = await nft.mintAccessNFT(
      user.address,
      doctor.address,
      MEDICAL_FILE_IPFS,
      encryptedAESKey
    );
    await tx.wait();

    expect(await nft.ownerOf(1)).to.equal(doctor.address);
  });

  it("Doctor accesses record", async () => {
    await manager.connect(doctor).accessRecord(1);
  });

  it("User revokes access", async () => {
    await nft.connect(user).revokeAccess(1);

    const data = await nft.accessData(1);
    expect(data.revoked).to.equal(true);
  });
});