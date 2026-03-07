import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { connectWalletWithPubKey } from "../utils/contract";

const API = "http://localhost:5010/api";

export default function UserRegister() {
  const [form, setForm] = useState({ name: "", phoneNumber: "", email: "" });
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("");
  const [error, setError] = useState("");

  const navigate = useNavigate();
  const { state } = useLocation();

  // address + publicKey already obtained in AuthGate and passed via state
  const preAddress = state?.address;
  const prePublicKey = state?.publicKey;

  const handleSubmit = async () => {
    setError("");
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

      setStep("Registering your profile...");
      const res = await fetch(`${API}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: address,
          pubkey: publicKey,   // ← schema field is "pubkey"
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
      setTimeout(() => navigate("/user/dashboard", { state: { address, publicKey, user } }), 700);

    } catch (err) {
      console.error(err);
      setError(err.message || "Registration failed. Please try again.");
      setLoading(false);
      setStep("");
    }
  };

  const isValid = form.name && form.phoneNumber && form.email;

  return (
    <div style={styles.root}>
      <div style={styles.orb1} /><div style={styles.orb2} />

      <div style={styles.card}>
        <button style={styles.back} onClick={() => navigate(-1)}>← Back</button>

        <div style={styles.iconWrap}>
          <span style={{ fontSize: 36 }}>👤</span>
        </div>

        <h2 style={styles.title}>Patient Registration</h2>
        <p style={styles.subtitle}>Create your decentralized health profile</p>

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
          <Field label="Full Name" placeholder="John Doe" value={form.name}
            onChange={v => setForm({ ...form, name: v })} icon="✦" color="#8b5cf6" />
          <Field label="Phone Number" placeholder="+1 (555) 000-0000" value={form.phoneNumber}
            onChange={v => setForm({ ...form, phoneNumber: v })} icon="📱" color="#8b5cf6" />
          <Field label="Email Address" placeholder="john@example.com" type="email"
            value={form.email} onChange={v => setForm({ ...form, email: v })} icon="✉️" color="#8b5cf6" />
        </div>

        {error && (
          <div style={styles.errorBox}><span>⚠️</span> {error}</div>
        )}

        {loading && step && (
          <div style={styles.stepBox}>
            <Spinner /><span style={{ color: "#94a3b8", fontSize: 13 }}>{step}</span>
          </div>
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
              ? <><Spinner dark /> {step}</>
              : <><span>✓</span> Complete Registration</>
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

function Spinner({ dark }) {
  const c = dark ? "#fff" : "#94a3b8";
  return (
    <span style={{
      width: 14, height: 14, border: `2px solid ${c}30`, borderTopColor: c,
      borderRadius: "50%", display: "inline-block",
      animation: "hc-spin 0.7s linear infinite", flexShrink: 0,
    }} />
  );
}

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