const { expect } = require("chai");
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

const {
  encryptMedicalData,
  decryptMedicalData,
  uploadToIPFS,
  fetchFromIPFS,
  encryptAESKeyForDoctor,
  decryptAESKey
} = require("./cryptoIpfsHelper");

describe("Healthcare System – Real IPFS + Encryption Flow", function () {
  let admin, patient, doctor;
  let registry, nft, manager;
  let testData;

  // 🔑 Hardhat default mnemonic
  const MNEMONIC =
    "test test test test test test test test test test test junk";

  before(async () => {
    [admin, patient, doctor] = await ethers.getSigners();

    testData = JSON.parse(
      fs.readFileSync(path.join(__dirname, "./data.json"))
    );
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

  it("Doctor registers & gets verified", async () => {
    await registry.connect(doctor).registerDoctor("DOCTOR_CERT_IPFS_HASH");
    await registry.verifyDoctor(doctor.address);

    expect(await registry.isDoctorVerified(doctor.address)).to.equal(true);
  });

it("Patient encrypts record, uploads to IPFS & mints NFT", async () => {
  const patientRecord = testData.patients[0];

  // 🔐 Encrypt medical data
  const { payload, aesKey } = encryptMedicalData(patientRecord);

  // 📦 Upload encrypted file to IPFS
  const ipfsHash = await uploadToIPFS(payload);

  // ✅ Derive REAL doctor wallet (index 2)
  const doctorWallet = ethers.Wallet.fromPhrase(
    MNEMONIC,
    ethers.provider,
    "m/44'/60'/0'/0/2"
  );

  // COMPRESSED public key - recommended
  const doctorPublicKey = doctorWallet.signingKey.compressedPublicKey;
  // If the above line fails in your ethers version, use:
  // const doctorPublicKey = ethers.computePublicKey(doctorWallet.publicKey, true);

  console.log("Doctor compressed pubkey:", doctorPublicKey);
  console.log("Length:", doctorPublicKey.length); // should be 68

  // 🔒 Encrypt AES key (now using bytes internally)
  const encryptedAESKey = encryptAESKeyForDoctor(aesKey, doctorPublicKey);

  // 🪙 Mint access NFT
  // Note: make sure mintAccessNFT expects encryptedAESKey as bytes/string/hex
  // If your contract expects bytes, keep as is; if string, do encryptedAESKey.toString('hex')
  await nft.mintAccessNFT(
    patient.address,
    doctor.address,
    ipfsHash,
    encryptedAESKey   // usually Buffer → ethers handles it as bytes
  );

  expect(await nft.ownerOf(1)).to.equal(doctor.address);
});
it("Doctor decrypts AES key, fetches IPFS file & reads record", async () => {
  const access = await nft.accessData(1);

  const doctorWallet = ethers.Wallet.fromPhrase(
    MNEMONIC,
    ethers.provider,
    "m/44'/60'/0'/0/2"
  );

  // Add this log to debug
  console.log("encryptedAESKey type:", typeof access.encryptedAESKey);
  console.log("encryptedAESKey starts with:", access.encryptedAESKey?.slice?.(0, 10)); // e.g. "0x..."

  const encryptedFile = await fetchFromIPFS(access.ipfsHash);

  const aesKey = decryptAESKey(
    access.encryptedAESKey,
    doctorWallet.privateKey
  );

  // aesKey should now be Buffer (32 bytes)
  console.log("Decrypted AES key length:", aesKey.length); // should print 32

  const decryptedRecord = decryptMedicalData(encryptedFile, aesKey);

  console.log("\n🩺 DECRYPTED MEDICAL RECORD:");
  console.log(decryptedRecord);

  expect(decryptedRecord.name).to.equal("Alice");
});


});