const crypto = require("crypto");
const ECIES = require("eciesjs");
const { getBytes } = require("ethers");   // ← add this import (ethers v5 or v6)

/* ---------------- IPFS CLIENT ---------------- */
let ipfsClient;
async function getIPFS() {
  if (!ipfsClient) {
    const { create } = await import("kubo-rpc-client");
    ipfsClient = create({ url: "http://127.0.0.1:5001" });
  }
  return ipfsClient;
}

async function uploadToIPFS(buffer) {
  try {
    const ipfs = await getIPFS();
    const result = await ipfs.add(buffer);
    const cid = result.cid.toString();
    console.log("Uploaded to IPFS with CID:", cid);
    return cid;
  } catch (err) {
    console.error("IPFS upload failed:", err);
    throw err;
  }
}

async function fetchFromIPFS(cid) {
  try {
    console.log("Fetching from IPFS CID:", cid);
    const ipfs = await getIPFS();
    const chunks = [];
    for await (const chunk of ipfs.cat(cid)) {
      chunks.push(chunk);
    }
    const data = Buffer.concat(chunks);
    console.log("Fetched bytes:", data.length);
    return data;
  } catch (err) {
    console.error("IPFS fetch failed:", err);
    throw err;
  }
}

/* ---------------- AES ---------------- */
function encryptMedicalData(data) {
  const aesKey = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv("aes-256-gcm", aesKey, iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(data)),
    cipher.final()
  ]);

  const tag = cipher.getAuthTag();

  return {
    payload: Buffer.concat([iv, encrypted, tag]),
    aesKey
  };
}

function decryptMedicalData(payload, aesKey) {
  const iv = payload.slice(0, 12);
  const tag = payload.slice(payload.length - 16);
  const encrypted = payload.slice(12, payload.length - 16);

  const decipher = crypto.createDecipheriv("aes-256-gcm", aesKey, iv);
  decipher.setAuthTag(tag);

  return JSON.parse(
    Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]).toString()
  );
}

/* ---------------- ECIES (Doctor Key Encryption) ---------------- */
function encryptAESKeyForDoctor(aesKey, doctorPublicKey) {
  // doctorPublicKey = "0x02..." or "0x03..." (compressed hex)
  const pubKeyBytes = getBytes(doctorPublicKey);  // → Uint8Array
  const encrypted = ECIES.encrypt(pubKeyBytes, aesKey);

  // Return as Buffer so contract can store as bytes easily
  return Buffer.from(encrypted);
}

function decryptAESKey(encryptedKey, doctorPrivateKey) {
  // Normalize private key to bytes
  const privKeyBytes = getBytes(doctorPrivateKey);  // "0x..." → Uint8Array

  // Normalize ciphertext: accept string (hex "0x..."), Buffer, Uint8Array
  let ciphertext;
  if (typeof encryptedKey === 'string') {
    // If it's hex string from contract (e.g. "0xabc..."), convert to bytes
    ciphertext = getBytes(encryptedKey);
  } else if (Buffer.isBuffer(encryptedKey)) {
    ciphertext = encryptedKey;
  } else if (encryptedKey instanceof Uint8Array) {
    ciphertext = Buffer.from(encryptedKey);
  } else {
    throw new Error("encryptedKey must be string (hex), Buffer, or Uint8Array");
  }

  // Now decrypt – eciesjs returns Buffer
  return ECIES.decrypt(privKeyBytes, ciphertext);
}

module.exports = {
  encryptMedicalData,
  decryptMedicalData,
  uploadToIPFS,
  fetchFromIPFS,
  encryptAESKeyForDoctor,
  decryptAESKey
};