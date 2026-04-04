import { PrivateKey } from "eciesjs";
import { keccak256, getBytes, hexlify } from "ethers";
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

export async function deriveUserKeypair(address) {
  const metamaskProvider = getMetaMaskProvider();
  const signature = await metamaskProvider.request({
    method: "eth_signTypedData_v4",
    params: [address, JSON.stringify(TYPED_DATA)],
  });

  const privKeyHex = keccak256(getBytes(signature));

  const sk = new PrivateKey(getBytes(privKeyHex));

  const pubKeyHex = hexlify(sk.publicKey.toBytes());

  return {
    privateKey: privKeyHex,
    publicKey: pubKeyHex,
  };
}