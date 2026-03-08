import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getContract, connectWalletWithPubKey } from "../utils/contract";
import { encryptFileForAdmin } from "../utils/crypto";
import { PrivateKey } from "eciesjs";
import { keccak256, getBytes, hexlify } from "ethers";

const API = "http://localhost:5010/api";
const ADMIN_PUBLIC_KEY = import.meta.env.VITE_ADMIN_DERIVED_PUBKEY;

const STEPS = [
  "Connecting MetaMask...",
  "Signing verification message...",
  "Encrypting documents...",
  "Uploading to IPFS...",
  "Saving to database...",
  "Registering on blockchain...",
  "Success! Redirecting...",
];

/* SAME typed data used in GenerateAdminKeys */
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


export default function DoctorRegister() {
  const [form, setForm] = useState({ name: "", phoneNumber: "", email: "" });
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [error, setError] = useState("");

  const navigate = useNavigate();
  const { state } = useLocation();

  // address + publicKey already obtained in AuthGate and passed via state
  const preAddress = state?.address;
  const prePublicKey = state?.publicKey;

  // ✅ Helper: Uint8Array → base64 string
function uint8ToBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

  /* DERIVE ECIES PUBLIC KEY */
  const derivePublicKey = async (address) => {
    const signature = await window.ethereum.request({
      method: "eth_signTypedData_v4",
      params: [address, JSON.stringify(TYPED_DATA)],
    });

    const privKeyHex = keccak256(getBytes(signature));
    const sk = new PrivateKey(getBytes(privKeyHex));
    const derivedpubkey = hexlify(sk.publicKey.toBytes());

    return derivedpubkey;
  };

 const handleSubmit = async () => {
  setError("");
  setLoading(true);
  setStepIdx(0);

  try {
    let address = preAddress;
    let publicKey = prePublicKey;

    if (!address || !publicKey) {
      setStepIdx(0);
      const result = await connectWalletWithPubKey();
      address = result.address;
      publicKey = result.publicKey;
    }

    setStepIdx(1);
    const contract = await getContract();
    const ipfsHashes = [];

    for (let file of files) {
      setStepIdx(2);
      // ✅ Now grab BOTH encryptedFile AND encryptedAESKey
      const { encryptedFile, encryptedAESKey } = await encryptFileForAdmin(file, ADMIN_PUBLIC_KEY);

      // ✅ Bundle them together as JSON, store as a single IPFS object
      const bundle = JSON.stringify({
        encryptedAESKey,                          // hex string
        encryptedFile: uint8ToBase64(encryptedFile), // Uint8Array → plain array for JSON
        mimeType: file.type,        // 🔥 store type
        originalName: file.name,   
      });

      const formData = new FormData();
      formData.append(
        "file",
        new Blob([bundle], { type: "application/json" }),
        `${file.name}.enc.json`
      );

      setStepIdx(3);
      const uploadRes = await fetch(`${API}/ipfs/upload`, { method: "POST", body: formData });
      if (!uploadRes.ok) throw new Error("IPFS upload failed");
      const { cid } = await uploadRes.json();
      ipfsHashes.push(cid);
    }
    const derivedpubkey = await derivePublicKey(address);
    // Save to DB
    setStepIdx(4);
    const res = await fetch(`${API}/doctors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        walletAddress: address,
        pubkey: publicKey,
        derivedpubkey:derivedpubkey,
        name: form.name,
        phoneNumber: form.phoneNumber,
        email: form.email,
        docs: ipfsHashes,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to save profile");
    }

    const { doctor } = await res.json();

    // Register on blockchain
    setStepIdx(5);
    const tx = await contract.registerDoctor(ipfsHashes);
    await tx.wait();

    setStepIdx(6);
    setTimeout(() => navigate("/doctor/dashboard", { state: { address, publicKey, doctor } }), 700);

  } catch (err) {
    console.error(err);
    setError(err.message || "Registration failed. Please try again.");
    setLoading(false);
  }
};

  const isValid = form.name && form.phoneNumber && form.email;

  return (
    <div style={styles.root}>
      <div style={styles.orb1} /><div style={styles.orb2} />

      <div style={styles.card}>
        <button style={styles.back} onClick={() => navigate(-1)}>← Back</button>

        <div style={styles.iconWrap}>
          <span style={{ fontSize: 36 }}>🩺</span>
        </div>

        <h2 style={styles.title}>Doctor Registration</h2>
        <p style={styles.subtitle}>Verify your credentials on the blockchain</p>

        {preAddress && (
          <div style={styles.walletTag}>
            <span style={{ fontSize: 14 }}>🦊</span>
            <span style={{ fontFamily: "monospace", fontSize: 12, color: "#94a3b8" }}>
              {preAddress.slice(0, 10)}...{preAddress.slice(-8)}
            </span>
            <span style={styles.connectedDot} />
          </div>
        )}

        <div style={styles.form}>
          <Field label="Full Name" placeholder="Dr. Jane Smith" value={form.name}
            onChange={v => setForm({ ...form, name: v })} icon="✦" color="#06b6d4" />
          <Field label="Phone Number" placeholder="+1 (555) 000-0000" value={form.phoneNumber}
            onChange={v => setForm({ ...form, phoneNumber: v })} icon="📱" color="#06b6d4" />
          <Field label="Email Address" placeholder="dr.jane@hospital.com" type="email"
            value={form.email} onChange={v => setForm({ ...form, email: v })} icon="✉️" color="#06b6d4" />
          <FileUpload files={files} onChange={setFiles} />
        </div>

        {loading && (
          <div style={styles.progressBox}>
            {STEPS.map((s, i) => (
              <div key={i} style={{
                ...styles.progressStep,
                color: i < stepIdx ? "#22d3ee" : i === stepIdx ? "#f0f4ff" : "#1e293b",
                fontWeight: i === stepIdx ? 700 : 400,
              }}>
                <span style={{ minWidth: 16, display: "inline-flex", alignItems: "center" }}>
                  {i < stepIdx ? "✓" : i === stepIdx ? <SmallSpinner /> : "·"}
                </span>
                {s}
              </div>
            ))}
          </div>
        )}

        {error && (
          <div style={styles.errorBox}><span>⚠️</span> {error}</div>
        )}

        <button
          style={{ ...styles.btn, opacity: (!isValid || loading) ? 0.5 : 1, cursor: (!isValid || loading) ? "not-allowed" : "pointer" }}
          onClick={handleSubmit}
          disabled={!isValid || loading}
          onMouseEnter={e => { if (isValid && !loading) e.currentTarget.style.transform = "translateY(-2px)"; }}
          onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
        >
          <span style={styles.btnInner}>
            {loading
              ? <><Spinner /> {STEPS[stepIdx]}</>
              : <><span>🦊</span> Connect Wallet & Register</>
            }
          </span>
        </button>

        <p style={styles.hint}>Requires MetaMask on Sepolia Testnet</p>
      </div>

      <style>{`@keyframes hc-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function Field({ label, placeholder, value, onChange, type = "text", icon, color }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={styles.fieldWrap}>
      <label style={styles.label}>{label}</label>
      <div style={{
        ...styles.inputWrap,
        borderColor: focused ? color : "rgba(255,255,255,0.08)",
        boxShadow: focused ? `0 0 0 3px ${color}20` : "none",
      }}>
        <span style={styles.inputIcon}>{icon}</span>
        <input
          type={type} placeholder={placeholder} value={value} style={styles.input}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        />
      </div>
    </div>
  );
}

function FileUpload({ files, onChange }) {
  const [drag, setDrag] = useState(false);
  return (
    <div style={styles.fieldWrap}>
      <label style={styles.label}>Credential Documents</label>
      <div
        style={{
          ...styles.dropzone,
          borderColor: drag ? "#06b6d4" : "rgba(255,255,255,0.08)",
          background: drag ? "rgba(6,182,212,0.04)" : "rgba(255,255,255,0.02)",
        }}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); onChange([...files, ...e.dataTransfer.files]); }}
        onClick={() => document.getElementById("dr-file-input").click()}
      >
        <input id="dr-file-input" type="file" multiple style={{ display: "none" }}
          onChange={e => onChange([...files, ...e.target.files])} />
        {files.length === 0 ? (
          <>
            <span style={{ fontSize: 28 }}>📁</span>
            <p style={{ color: "#475569", margin: 0, fontSize: 13 }}>
              Drop files or <span style={{ color: "#06b6d4" }}>browse</span>
            </p>
          </>
        ) : (
          <div style={{ width: "100%" }}>
            {files.map((f, i) => (
              <div key={i} style={styles.fileItem}>
                <span style={{ fontSize: 13, color: "#cbd5e1" }}>📄 {f.name}</span>
                <span style={{ fontSize: 11, color: "#475569" }}>{(f.size / 1024).toFixed(1)} KB</span>
              </div>
            ))}
            <button style={styles.addMore} onClick={e => { e.stopPropagation(); document.getElementById("dr-file-input").click(); }}>
              + Add more files
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Spinner() {
  return <span style={{ width: 14, height: 14, border: "2px solid rgba(0,0,0,0.2)", borderTopColor: "#000", borderRadius: "50%", display: "inline-block", animation: "hc-spin 0.7s linear infinite", flexShrink: 0 }} />;
}

function SmallSpinner() {
  return <span style={{ width: 11, height: 11, border: "2px solid rgba(6,182,212,0.3)", borderTopColor: "#06b6d4", borderRadius: "50%", display: "inline-block", animation: "hc-spin 0.7s linear infinite" }} />;
}

const styles = {
  root: {
    minHeight: "100vh", background: "#060a12",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
    position: "relative", overflow: "hidden", padding: 24,
  },
  orb1: {
    position: "absolute", top: "-20%", left: "-10%", width: 500, height: 500, borderRadius: "50%",
    background: "radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 70%)", pointerEvents: "none",
  },
  orb2: {
    position: "absolute", bottom: "-20%", right: "-10%", width: 400, height: 400, borderRadius: "50%",
    background: "radial-gradient(circle, rgba(139,92,246,0.07) 0%, transparent 70%)", pointerEvents: "none",
  },
  card: {
    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 24, padding: "40px 36px", width: "100%", maxWidth: 460,
    position: "relative", zIndex: 1, backdropFilter: "blur(20px)",
  },
  back: { background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 14, padding: 0, marginBottom: 28, display: "block" },
  iconWrap: {
    width: 72, height: 72, borderRadius: 20,
    background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.25)",
    display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20,
  },
  title: { fontSize: 26, fontWeight: 800, color: "#f0f4ff", margin: "0 0 8px" },
  subtitle: { fontSize: 14, color: "#64748b", margin: "0 0 20px" },
  walletTag: {
    display: "flex", alignItems: "center", gap: 8,
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 10, padding: "8px 14px", marginBottom: 20,
  },
  connectedDot: { width: 8, height: 8, borderRadius: "50%", background: "#10b981", marginLeft: "auto" },
  form: { display: "flex", flexDirection: "column", gap: 16 },
  fieldWrap: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 12, fontWeight: 600, color: "#64748b", letterSpacing: "0.06em", textTransform: "uppercase" },
  inputWrap: {
    display: "flex", alignItems: "center", gap: 10,
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12, padding: "12px 14px", transition: "all 0.2s",
  },
  inputIcon: { fontSize: 15, opacity: 0.6 },
  input: { background: "none", border: "none", outline: "none", color: "#f0f4ff", fontSize: 15, width: "100%" },
  dropzone: {
    border: "1.5px dashed rgba(255,255,255,0.1)", borderRadius: 12, padding: 20,
    display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
    cursor: "pointer", transition: "all 0.2s",
  },
  fileItem: {
    display: "flex", justifyContent: "space-between",
    padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.04)",
  },
  addMore: { background: "none", border: "none", color: "#06b6d4", cursor: "pointer", fontSize: 12, marginTop: 8, padding: 0 },
  progressBox: {
    marginTop: 16, background: "rgba(0,0,0,0.25)", borderRadius: 12,
    padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8,
  },
  progressStep: { display: "flex", alignItems: "center", gap: 10, fontSize: 12, transition: "all 0.3s" },
  errorBox: {
    background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
    borderRadius: 10, padding: "11px 14px", color: "#fca5a5", fontSize: 13,
    display: "flex", gap: 8, marginTop: 14,
  },
  btn: {
    width: "100%", marginTop: 18,
    background: "linear-gradient(135deg, #06b6d4, #0284c7)",
    border: "none", borderRadius: 12, padding: "14px 0",
    color: "#000", fontWeight: 700, fontSize: 15, cursor: "pointer",
    transition: "all 0.2s cubic-bezier(0.34,1.56,0.64,1)",
    boxShadow: "0 4px 20px rgba(6,182,212,0.35)",
  },
  btnInner: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8 },
  hint: { textAlign: "center", fontSize: 12, color: "#475569", marginTop: 14 },
};