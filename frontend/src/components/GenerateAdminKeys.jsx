import { PrivateKey } from "eciesjs";
import { keccak256, getBytes, hexlify } from "ethers";

// ✅ Shared typed data — must be identical in generator AND decryption
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

export function GenerateAdminKeys() {
  const generate = async () => {
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const address = accounts[0];
      console.log("Wallet:", address);

      // ✅ EIP-712 typed data sign — deterministic, works on all MetaMask versions
      const signature = await window.ethereum.request({
        method: "eth_signTypedData_v4",
        params: [address, JSON.stringify(TYPED_DATA)],
      });
      console.log("Signature:", signature);

      const privKeyHex = keccak256(getBytes(signature));
      console.log("Derived privKey:", privKeyHex);

      const sk = new PrivateKey(getBytes(privKeyHex));
      const pubKeyHex = hexlify(sk.publicKey.toBytes());
      console.log("Derived pubKey:", pubKeyHex);

      alert(
        `✅ Add this to your .env\n\n` +
        `VITE_ADMIN_DERIVED_PUBKEY=${pubKeyHex}`
      );

    } catch (err) {
      alert("Error: " + err.message);
      console.error(err);
    }
  };

  return (
    <button
      onClick={generate}
      style={{
        position: "fixed", bottom: 24, right: 24, zIndex: 9999,
        background: "red", color: "#fff", border: "none",
        borderRadius: 10, padding: "12px 20px",
        fontWeight: 800, cursor: "pointer", fontSize: 14,
      }}
    >
      🔑 Generate Admin Keys
    </button>
  );
}