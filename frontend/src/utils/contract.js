import { ethers } from "ethers";
import DoctorRegistryABI from "../abi/DoctorRegistryABI.json";
import MedicalRecordABI from "../abi/MedicalAccessNFT.json";
import { getBytes, hexlify, keccak256 } from "ethers";

const CONTRACT_ADDRESS         = import.meta.env.VITE_DOCTOR_CONTRACT;
const MEDICAL_CONTRACT_ADDRESS = import.meta.env.VITE_MEDICAL_CONTRACT;
const SEPOLIA_CHAIN_ID         = "0xaa36a7"; // 11155111 in hex

export const ADMIN_WALLET = import.meta.env.VITE_ADMIN_WALLET?.toLowerCase();

// ─── Network ─────────────────────────────────────────────────────────────────

export const checkAndSwitchToSepolia = async () => {
  const metamaskProvider = getMetaMaskProvider();
  const chainId = await metamaskProvider.request({ method: "eth_chainId" });

  if (chainId !== SEPOLIA_CHAIN_ID) {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: SEPOLIA_CHAIN_ID }],
      });
    } catch (switchError) {
      if (switchError.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: SEPOLIA_CHAIN_ID,
            chainName: "Sepolia Testnet",
            nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
            rpcUrls: ["https://rpc.sepolia.org"],
            blockExplorerUrls: ["https://sepolia.etherscan.io"],
          }],
        });
      } else {
        throw new Error("Please switch to Sepolia Testnet in MetaMask");
      }
    }
  }
};

export const getMetaMaskProvider = () => {
  if (window.ethereum?.providers) {
    return window.ethereum.providers.find(p => p.isMetaMask);
  }
  return window.ethereum;
};

// ─── Wallet ───────────────────────────────────────────────────────────────────

export const connectWallet = async () => {
  if (!window.ethereum) {
    throw new Error("MetaMask not installed. Please install MetaMask to continue.");
  }
  await checkAndSwitchToSepolia();
  const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
  return accounts[0];
};

export async function connectWalletWithPubKey() {
  if (!window.ethereum.isMetaMask) {
    throw new Error("Please use MetaMask. Other wallets are not supported.");
  }

  await checkAndSwitchToSepolia();

  const metamaskProvider = getMetaMaskProvider();
  if (!metamaskProvider || !metamaskProvider.isMetaMask) {
    throw new Error("MetaMask is required.");
  }

  const provider = new ethers.BrowserProvider(metamaskProvider);
  await provider.send("eth_requestAccounts", []);

  const signer   = await provider.getSigner();
  const address  = await signer.getAddress();

  const message    = "Healthcare DApp Public Key Verification";
  const signature  = await signer.signMessage(message);
  const messageHash          = ethers.hashMessage(message);
  const publicKeyUncompressed = ethers.SigningKey.recoverPublicKey(messageHash, signature);
  const publicKeyCompressed   = ethers.SigningKey.computePublicKey(publicKeyUncompressed, true);

  console.log("Connected address:", address);
  console.log("Derived public key:", publicKeyCompressed);
  return { address, publicKey: publicKeyCompressed };
}

// ─── Contract getters ─────────────────────────────────────────────────────────

/**
 * Returns the DoctorRegistry contract with a signer (write-capable).
 */
export const getContract = async () => {
  await checkAndSwitchToSepolia();
  const metamaskProvider = getMetaMaskProvider();
  const provider = new ethers.BrowserProvider(metamaskProvider);
  const signer   = await provider.getSigner();
  return new ethers.Contract(CONTRACT_ADDRESS, DoctorRegistryABI, signer);
};

/**
 * Returns the MedicalAccessNFT contract with a signer.
 */
export const getMedicalContract = async () => {
  await checkAndSwitchToSepolia();
  const metamaskProvider = getMetaMaskProvider();
  const provider = new ethers.BrowserProvider(metamaskProvider);
  const signer   = await provider.getSigner();
  return new ethers.Contract(MEDICAL_CONTRACT_ADDRESS, MedicalRecordABI, signer);
};

// ─── Admin decryption key ─────────────────────────────────────────────────────

const TYPED_DATA = {
  domain:      { name: "HealthChain", version: "1" },
  types:       { AdminKey: [{ name: "purpose", type: "string" }, { name: "version", type: "string" }] },
  primaryType: "AdminKey",
  message:     { purpose: "Admin Decryption Key", version: "v1" },
};

export async function getAdminDecryptionKey() {
  if (!window.ethereum) throw new Error("MetaMask not installed.");
  await checkAndSwitchToSepolia();
  const provider = await getMetaMaskProvider();

  const accounts = await provider.request({ method: "eth_requestAccounts" });
  const address  = accounts[0];

  const signature    = await provider.request({
    method: "eth_signTypedData_v4",
    params: [address, JSON.stringify(TYPED_DATA)],
  });

  return keccak256(getBytes(signature));
}

// ─── Doctor Registry reads ────────────────────────────────────────────────────

/**
 * Returns true if the doctor is verified AND not suspended.
 * Uses the on-chain isDoctorVerified() which already accounts for isSuspended.
 */
export async function isDoctorVerified(address) {
  try {
    const contract = await getContract();
    console.log("checking isDoctorVerified:", address);
    const result = await contract.isDoctorVerified(address);
    console.log("isDoctorVerified result:", result);
    return result;
  } catch (err) {
    console.error("isDoctorVerified error:", err);
    return false;
  }
}

/**
 * Returns the raw doctors mapping struct for the given address.
 * Useful for checking isSuspended separately.
 */
export async function isDoctorSuspended(address) {
  try {
    const contract = await getContract();
    const doctor   = await contract.doctors(address);
    return doctor.isSuspended;
  } catch (err) {
    console.error("isDoctorSuspended error:", err);
    return false;
  }
}

export async function getDoctorCertificates(address) {
  const contract = await getContract();
  return contract.getDoctorCertificates(address);
}

// ─── Doctor Registry writes (admin only) ─────────────────────────────────────

export async function verifyDoctorOnChain(doctorAddress) {
  const contract = await getContract();
  const tx       = await contract.verifyDoctor(doctorAddress);
  await tx.wait();
  return tx;
}

export async function suspendDoctorOnChain(doctorAddress) {
  const contract = await getContract();
  const tx       = await contract.suspendDoctor(doctorAddress);
  await tx.wait();
  return tx;
}

export async function unsuspendDoctorOnChain(doctorAddress) {
  const contract = await getContract();
  const tx       = await contract.unsuspendDoctor(doctorAddress);
  await tx.wait();
  return tx;
}

// ─── Medical NFT writes ───────────────────────────────────────────────────────

/**
 * Revokes all NFT access tokens belonging to a doctor.
 * Called by admin when suspending a doctor.
 */
export async function revokeAllForDoctorOnChain(doctorAddress) {
  const contract = await getMedicalContract();
  const tx       = await contract.revokeAllForDoctor(doctorAddress);
  await tx.wait();
  return tx;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function isAdminWallet(address) {
  if (!address || !ADMIN_WALLET) return false;
  return address.toLowerCase() === ADMIN_WALLET;
}