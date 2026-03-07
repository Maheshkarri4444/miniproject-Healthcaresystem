import { ethers } from "ethers";
import DoctorRegistryABI from "../abi/DoctorRegistryABI.json";
import { getBytes, hexlify, keccak256 } from "ethers";


const CONTRACT_ADDRESS = "0xF9fcf870Ae8F603bC6736f5C528618bfA357353d";
const SEPOLIA_CHAIN_ID = "0xaa36a7"; // 11155111 in hex

export const ADMIN_WALLET = import.meta.env.VITE_ADMIN_WALLET?.toLowerCase();


export const checkAndSwitchToSepolia = async () => {
  if (!window.ethereum) {
    throw new Error("MetaMask not installed");
  }

  const chainId = await window.ethereum.request({ method: "eth_chainId" });

  if (chainId !== SEPOLIA_CHAIN_ID) {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: SEPOLIA_CHAIN_ID }],
      });
    } catch (switchError) {
      // Chain not added, try to add it
      if (switchError.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: SEPOLIA_CHAIN_ID,
              chainName: "Sepolia Testnet",
              nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
              rpcUrls: ["https://rpc.sepolia.org"],
              blockExplorerUrls: ["https://sepolia.etherscan.io"],
            },
          ],
        });
      } else {
        throw new Error("Please switch to Sepolia Testnet in MetaMask");
      }
    }
  }
};

export const connectWallet = async () => {
  if (!window.ethereum) {
    throw new Error("MetaMask not installed. Please install MetaMask to continue.");
  }

  await checkAndSwitchToSepolia();

  const accounts = await window.ethereum.request({
    method: "eth_requestAccounts",
  });

  return accounts[0];
};

export const getContract = async () => {
  await checkAndSwitchToSepolia();
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();

  return new ethers.Contract(CONTRACT_ADDRESS, DoctorRegistryABI, signer);
};

export async function connectWalletWithPubKey() {
  if (!window.ethereum) {
    throw new Error("MetaMask not installed. Please install MetaMask to continue.");
  }

  await checkAndSwitchToSepolia();

  const provider = new ethers.BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);

  const signer = await provider.getSigner();
  const address = await signer.getAddress();

  const message = "Healthcare DApp Public Key Verification";
  const signature = await signer.signMessage(message);

  const messageHash = ethers.hashMessage(message);
  const publicKeyUncompressed = ethers.SigningKey.recoverPublicKey(messageHash, signature);
  const publicKeyCompressed = ethers.SigningKey.computePublicKey(publicKeyUncompressed, true);

  return { address, publicKey: publicKeyCompressed };
}

/**
 * Derives a deterministic decryption key from the admin's wallet signature.
 * The private key NEVER leaves the browser — it lives only in memory during decryption.
 * MetaMask will prompt the admin to sign a message to authorize decryption.
 */

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
  if (!window.ethereum) throw new Error("MetaMask not installed.");
  await checkAndSwitchToSepolia();

  const accounts = await window.ethereum.request({
    method: "eth_requestAccounts",
  });

  const address = accounts[0];

  // 🔥 EXACT SAME SIGNING METHOD AS GENERATOR
  const signature = await window.ethereum.request({
    method: "eth_signTypedData_v4",
    params: [address, JSON.stringify(TYPED_DATA)],
  });

  // 🔥 EXACT SAME HASHING METHOD
  const decryptionKey = keccak256(getBytes(signature));

  return decryptionKey;
}

export async function isDoctorVerified(address) {
  const contract = await getContract(true);
  return contract.isDoctorVerified(address);
}

export async function getDoctorCertificates(address) {
  const contract = await getContract(true);
  return contract.getDoctorCertificates(address);
}

export async function verifyDoctorOnChain(doctorAddress) {
  const contract = await getContract(false);
  const tx = await contract.verifyDoctor(doctorAddress);
  await tx.wait();
  return tx;
}

export function isAdminWallet(address) {
  if (!address || !ADMIN_WALLET) return false;
  return address.toLowerCase() === ADMIN_WALLET;
}