import { encrypt, decrypt } from "eciesjs";
import { getBytes, hexlify, keccak256 } from "ethers";
import { recoverAddress,  toUtf8Bytes } from "ethers";
// ✅ Must be byte-for-byte identical to GenerateAdminKeys.jsx
import { getMetaMaskProvider} from "./contract";
const TYPED_DATA = {
  domain: {
    name: "HealthChain",
    version: "1",
  },
  types: {
    AdminKey: [
      { name: "purpose", type: "string" },
      { name: "version", type: "string" },
    ],
  },
  primaryType: "AdminKey",
  message: {
    purpose: "Admin Decryption Key",
    version: "v1",
  },
};
export async function getAdminDecryptionKey() {
  const metamaskProvider = getMetaMaskProvider();

  if (!metamaskProvider || !metamaskProvider.isMetaMask) {
    throw new Error("MetaMask not installed or not selected.");
  }

  await checkAndSwitchToSepolia();

  // Request account from SAME provider
  const accounts = await metamaskProvider.request({
    method: "eth_requestAccounts",
  });

  const address = accounts[0];

  // ✅ Use SAME provider for signing (FIXED)
  const signature = await metamaskProvider.request({
    method: "eth_signTypedData_v4",
    params: [address, JSON.stringify(TYPED_DATA)],
  });

  // Deterministic key derivation
  const decryptionKey = keccak256(getBytes(signature));

  return decryptionKey;
}

export async function encryptFileForAdmin(file, adminPublicKey) {
  const arrayBuffer = await file.arrayBuffer();
  const fileBytes = new Uint8Array(arrayBuffer);

  const aesKey = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const cryptoKey = await crypto.subtle.importKey(
    "raw", aesKey, { name: "AES-GCM" }, false, ["encrypt"]
  );

  const encryptedContent = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv }, cryptoKey, fileBytes
  );

  const encryptedFile = new Uint8Array([...iv, ...new Uint8Array(encryptedContent)]);

  const pubKeyBytes = getBytes(adminPublicKey);
  const encryptedAESKeyBytes = encrypt(pubKeyBytes, aesKey);
  const encryptedAESKeyHex = hexlify(encryptedAESKeyBytes);

  return { encryptedFile, encryptedAESKey: encryptedAESKeyHex };
}

export async function decryptFileFromAdmin(
  encryptedFileBuffer,
  encryptedAESKeyHex,
  adminPrivateKeyHex
) {
  const encryptedAESKeyBytes = getBytes(encryptedAESKeyHex);
  const privKeyBytes = getBytes(adminPrivateKeyHex);

  const aesKey = decrypt(privKeyBytes, encryptedAESKeyBytes);

  const cryptoKey = await crypto.subtle.importKey(
    "raw", aesKey, { name: "AES-GCM" }, false, ["decrypt"]
  );

  const encryptedBytes = new Uint8Array(encryptedFileBuffer);
  const iv = encryptedBytes.slice(0, 12);
  const ciphertext = encryptedBytes.slice(12);

  const decryptedContent = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv }, cryptoKey, ciphertext
  );

  return new Uint8Array(decryptedContent);
}