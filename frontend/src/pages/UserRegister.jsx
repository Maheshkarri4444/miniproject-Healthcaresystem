

import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { connectWalletWithPubKey } from "../utils/contract";
import { PrivateKey } from "eciesjs";
import { keccak256, getBytes, hexlify } from "ethers";
import { getMetaMaskProvider } from "../utils/contract";

const API = "http://localhost:5010/api";

const TYPED_DATA = {
  domain: { name: "HealthChain", version: "1" },
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

export default function UserRegister() {
  const [form, setForm] = useState({ name: "", phoneNumber: "", email: "" });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("");
  const [error, setError] = useState("");
  const [emailChecking, setEmailChecking] = useState(false);

  const navigate = useNavigate();
  const { state } = useLocation();

  const preAddress = state?.address;
  const prePublicKey = state?.publicKey;

  // VALIDATION
  const validateField = (name, value) => {
    let msg = "";

    if (name === "name") {
      if (!value) msg = "Name is required";
      else if (value.length < 3) msg = "Minimum 3 characters required";
    }

    if (name === "phoneNumber") {
      if (!value) msg = "Phone number is required";
      else if (!/^[0-9]{10,15}$/.test(value))
        msg = "Enter valid phone number";
    }

    if (name === "email") {
      if (!value) msg = "Email is required";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
        msg = "Enter valid email address";
    }

    return msg;
  };

  const handleChange = (field, value) => {
    setForm({ ...form, [field]: value });

    const errorMsg = validateField(field, value);
    setErrors((prev) => ({ ...prev, [field]: errorMsg }));
  };

  const checkEmailUnique = async (email) => {
    if (!email) return;

    try {
      setEmailChecking(true);

      const res = await fetch(`${API}/users/check-email?email=${email}`);
      const data = await res.json();

      if (!data.unique) {
        setErrors((prev) => ({
          ...prev,
          email: "Email already registered",
        }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setEmailChecking(false);
    }
  };

  const derivePublicKey = async (address) => {
    const provider = await getMetaMaskProvider();
    const signature = await provider.request({
      method: "eth_signTypedData_v4",
      params: [address, JSON.stringify(TYPED_DATA)],
    });

    const privKeyHex = keccak256(getBytes(signature));
    const sk = new PrivateKey(getBytes(privKeyHex));
    return hexlify(sk.publicKey.toBytes());
  };

  const handleSubmit = async () => {
    setError("");

    // FINAL VALIDATION CHECK
    const newErrors = {
      name: validateField("name", form.name),
      phoneNumber: validateField("phoneNumber", form.phoneNumber),
      email: validateField("email", form.email),
    };

    setErrors(newErrors);

    if (Object.values(newErrors).some((e) => e)) return;

    setLoading(true);

    try {
      let address = preAddress;
      let publicKey = prePublicKey;

      if (!address || !publicKey) {
        setStep("Connecting MetaMask...");
        const result = await connectWalletWithPubKey();
        address = result.address;
        publicKey = result.publicKey;
      }

      setStep("Generating encryption keys...");
      const derivedpubkey = await derivePublicKey(address);

      setStep("Registering your profile...");

      const res = await fetch(`${API}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: address,
          pubkey: publicKey,
          derivedpubkey,
          name: form.name,
          phoneNumber: form.phoneNumber,
          email: form.email,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Registration failed");
      }

      const { user } = await res.json();

      setStep("Success! Redirecting...");

      setTimeout(() => {
        navigate("/user/dashboard", {
          state: { address, publicKey, derivedpubkey, user },
        });
      }, 700);
    } catch (err) {
      console.error(err);
      setError(err.message || "Registration failed");
      setLoading(false);
      setStep("");
    }
  };

  const isValid =
    form.name &&
    form.phoneNumber &&
    form.email &&
    !errors.name &&
    !errors.phoneNumber &&
    !errors.email;

  return (
    <div style={styles.root}>
      <div style={styles.orb1} />
      <div style={styles.orb2} />

      <div style={styles.card}>
        <button style={styles.back} onClick={() => navigate(-1)}>
          ← Back
        </button>

        <div style={styles.iconWrap}>
          <span style={{ fontSize: 36 }}>👤</span>
        </div>

        <h2 style={styles.title}>Patient Registration</h2>
        <p style={styles.subtitle}>
          Create your decentralized health profile
        </p>

        <div style={styles.form}>
          <Field
            label="Full Name"
            value={form.name}
            onChange={(v) => handleChange("name", v)}
            error={errors.name}
          />

          <Field
            label="Phone Number"
            value={form.phoneNumber}
            onChange={(v) => handleChange("phoneNumber", v)}
            error={errors.phoneNumber}
          />

          <Field
            label="Email Address"
            value={form.email}
            onChange={(v) => handleChange("email", v)}
            onBlur={() => checkEmailUnique(form.email)}
            error={errors.email}
          />
        </div>

        {error && <div style={styles.errorBox}>⚠️ {error}</div>}

        <button
          style={{
            ...styles.btn,
            opacity: !isValid ? 0.5 : 1,
          }}
          disabled={!isValid}
          onClick={handleSubmit}
        >
          Complete Registration
        </button>
      </div>
    </div>
  );
}

// FIELD COMPONENT WITH ERROR UI
function Field({ label, value, onChange, error, onBlur }) {
  return (
    <div style={styles.fieldWrap}>
      <label style={styles.label}>{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        style={{
          ...styles.input,
          borderColor: error ? "#ef4444" : "#ccc",
        }}
      />
      {error && <span style={{ color: "red" }}>⚠️ {error}</span>}
    </div>
  );
}

// KEEP YOUR ORIGINAL STYLES SAME

const styles = {
  root: {
    minHeight: "100vh", background: "#060a12",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
    position: "relative", overflow: "hidden", padding: 24,
  },
  orb1: {
    position: "absolute", top: "-20%", right: "-10%", width: 500, height: 500, borderRadius: "50%",
    background: "radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)", pointerEvents: "none",
  },
  orb2: {
    position: "absolute", bottom: "-20%", left: "-10%", width: 400, height: 400, borderRadius: "50%",
    background: "radial-gradient(circle, rgba(6,182,212,0.07) 0%, transparent 70%)", pointerEvents: "none",
  },
  card: {
    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 24, padding: "40px 36px", width: "100%", maxWidth: 440,
    position: "relative", zIndex: 1, backdropFilter: "blur(20px)",
  },
  back: { background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 14, padding: 0, marginBottom: 28, display: "block" },
  iconWrap: {
    width: 72, height: 72, borderRadius: 20,
    background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.25)",
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
  errorBox: {
    background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
    borderRadius: 10, padding: "11px 14px", color: "#fca5a5", fontSize: 13,
    display: "flex", gap: 8, marginTop: 16,
  },
  stepBox: {
    display: "flex", alignItems: "center", gap: 10,
    background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.15)",
    borderRadius: 10, padding: "11px 14px", marginTop: 14,
  },
  btn: {
    width: "100%", marginTop: 20,
    background: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
    border: "none", borderRadius: 12, padding: "14px 0",
    color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer",
    transition: "all 0.2s cubic-bezier(0.34,1.56,0.64,1)",
    boxShadow: "0 4px 20px rgba(139,92,246,0.35)",
  },
  btnInner: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8 },
  hint: { textAlign: "center", fontSize: 12, color: "#475569", marginTop: 14 },
};