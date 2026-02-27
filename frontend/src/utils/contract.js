import { ethers } from "ethers";
import DoctorRegistryABI from "../abi/DoctorRegistryABI.json";

const CONTRACT_ADDRESS = "0xF9fcf870Ae8F603bC6736f5C528618bfA357353d";

export const connectWallet = async () => {
  if (!window.ethereum) {
    alert("Install MetaMask");
    return null;
  }

  const accounts = await window.ethereum.request({
    method: "eth_requestAccounts",
  });

  return accounts[0];
};

export const getContract = async () => {
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();

  return new ethers.Contract(
    CONTRACT_ADDRESS,
    DoctorRegistryABI,
    signer
  );
};