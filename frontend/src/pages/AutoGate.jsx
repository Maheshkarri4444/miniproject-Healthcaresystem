import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { connectWalletWithPubKey, isAdminWallet } from "../utils/contract";

const API = "http://localhost:5010/api";

export default function AuthGate() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("");
  const [error, setError] = useState("");

  const handleConnect = async () => {
    setError("");
    setLoading(true);

    try {
      // Step 1: Connect wallet AND get public key in one shot
      setStep("Opening MetaMask...");
      const { address, publicKey } = await connectWalletWithPubKey();

      // Step 2: Admin check
      if (isAdminWallet(address)) {
        setStep("Admin wallet detected. Redirecting...");
        setTimeout(() => navigate("/admin", { state: { address } }), 500);
        return;
      }

      // Step 3: Check if already a registered doctor
      setStep("Checking your account...");
      const doctorRes = await fetch(`${API}/doctors/${address}`);
      console.log("doctor accounts: ",doctorRes);
      if (doctorRes.ok) {
        const doctor = await doctorRes.json();
        setStep("Doctor account found! Redirecting...");
        setTimeout(() => navigate("/doctor/dashboard", { state: { address, publicKey, doctor } }), 500);
        return;
      }

      // Step 4: Check if already a registered patient
      const userRes = await fetch(`${API}/users/address/${address}`);
      if (userRes.ok) {
        const user = await userRes.json();
        setStep("Patient account found! Redirecting...");
        setTimeout(() => navigate("/user/dashboard", { state: { address, publicKey, user } }), 500);
        return;
      }

      // Step 5: New wallet — pick a role
      setStep("New wallet — choose your role...");
      setTimeout(() => navigate("/select-role", { state: { address, publicKey } }), 500);

    } catch (err) {
      console.error(err);
      setError(err.message || "Connection failed. Please try again.");
      setLoading(false);
      setStep("");
    }
  };

  return (
    <div style={styles.root}>
      <div style={styles.bg}>
        <div style={styles.orb1} />
        <div style={styles.orb2} />
        <div style={styles.orb3} />
        <div style={styles.grid} />
      </div>

      <div style={styles.content}>
        <div style={styles.logoRow}>
          <div style={styles.logoIcon}>⬡</div>
          <span style={styles.logoText}>
            Health<span style={styles.logoAccent}>Chain</span>
          </span>
        </div>

        <h1 style={styles.headline}>
          Healthcare on the<br />
          <span style={styles.headlineGrad}>Blockchain</span>
        </h1>

        <p style={styles.tagline}>
          Decentralized medical records. Encrypted. Owned by you.<br />
          Connect your wallet to get started.
        </p>

        <div style={styles.features}>
          {[
            { icon: "🔐", text: "End-to-end encrypted records" },
            { icon: "⛓️", text: "On-chain doctor verification" },
            { icon: "🧬", text: "Patient-controlled data access" },
          ].map((f, i) => (
            <div key={i} style={styles.featureItem}>
              <span style={styles.featureIcon}>{f.icon}</span>
              <span style={styles.featureText}>{f.text}</span>
            </div>
          ))}
        </div>

        {error && (
          <div style={styles.errorBox}>
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {loading && step && (
          <div style={styles.stepBox}>
            <Spinner color="#06b6d4" />
            <span style={{ color: "#94a3b8", fontSize: 14 }}>{step}</span>
          </div>
        )}

        <button
          style={{ ...styles.connectBtn, opacity: loading ? 0.7 : 1, cursor: loading ? "wait" : "pointer" }}
          onClick={handleConnect}
          disabled={loading}
          onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = "translateY(-3px) scale(1.02)"; e.currentTarget.style.boxShadow = "0 12px 40px rgba(6,182,212,0.5)"; } }}
          onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0) scale(1)"; e.currentTarget.style.boxShadow = "0 4px 24px rgba(6,182,212,0.35)"; }}
        >
          {loading
            ? <span style={styles.btnInner}><Spinner color="#000" size={16} /> Connecting...</span>
            : <span style={styles.btnInner}><span style={{ fontSize: 20 }}>🦊</span> Connect with MetaMask</span>
          }
        </button>

        <p style={styles.networkNote}>⬡ Sepolia Testnet Required</p>
      </div>

      <style>{`@keyframes hc-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function Spinner({ color = "#fff", size = 14 }) {
  return (
    <span style={{
      width: size, height: size,
      border: `2px solid ${color}40`, borderTopColor: color,
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
  bg: { position: "absolute", inset: 0, pointerEvents: "none" },
  orb1: {
    position: "absolute", top: "-15%", left: "-8%", width: 600, height: 600, borderRadius: "50%",
    background: "radial-gradient(circle, rgba(6,182,212,0.14) 0%, transparent 65%)",
  },
  orb2: {
    position: "absolute", bottom: "-20%", right: "-10%", width: 700, height: 700, borderRadius: "50%",
    background: "radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 65%)",
  },
  orb3: {
    position: "absolute", top: "50%", left: "55%", width: 300, height: 300, borderRadius: "50%",
    background: "radial-gradient(circle, rgba(16,185,129,0.05) 0%, transparent 70%)",
  },
  grid: {
    position: "absolute", inset: 0,
    backgroundImage: `linear-gradient(rgba(6,182,212,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.03) 1px, transparent 1px)`,
    backgroundSize: "60px 60px",
  },
  content: {
    position: "relative", zIndex: 1,
    display: "flex", flexDirection: "column", alignItems: "center", gap: 24,
    maxWidth: 520, width: "100%", textAlign: "center",
  },
  logoRow: { display: "flex", alignItems: "center", gap: 10 },
  logoIcon: {
    width: 40, height: 40, borderRadius: 10,
    background: "linear-gradient(135deg, #06b6d4, #0284c7)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 20, color: "#fff", fontWeight: 900,
    boxShadow: "0 4px 16px rgba(6,182,212,0.4)",
  },
  logoText: { fontSize: 24, fontWeight: 800, color: "#f0f4ff", letterSpacing: "-0.5px" },
  logoAccent: {
    background: "linear-gradient(135deg, #06b6d4, #8b5cf6)",
    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
  },
  headline: {
    fontSize: "clamp(36px, 7vw, 60px)", fontWeight: 800, color: "#f0f4ff",
    margin: 0, lineHeight: 1.15, letterSpacing: "-1.5px",
  },
  headlineGrad: {
    background: "linear-gradient(135deg, #06b6d4 30%, #8b5cf6 100%)",
    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
  },
  tagline: { fontSize: 16, color: "#64748b", margin: 0, lineHeight: 1.7 },
  features: {
    display: "flex", flexDirection: "column", gap: 10, width: "100%",
    background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 16, padding: "20px 24px",
  },
  featureItem: { display: "flex", alignItems: "center", gap: 12, textAlign: "left" },
  featureIcon: { fontSize: 20, flexShrink: 0 },
  featureText: { fontSize: 14, color: "#94a3b8" },
  errorBox: {
    background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)",
    borderRadius: 12, padding: "12px 16px", color: "#fca5a5", fontSize: 13,
    display: "flex", gap: 8, alignItems: "center", width: "100%", textAlign: "left",
  },
  stepBox: {
    display: "flex", alignItems: "center", gap: 10,
    background: "rgba(6,182,212,0.06)", border: "1px solid rgba(6,182,212,0.15)",
    borderRadius: 12, padding: "12px 20px", width: "100%", justifyContent: "center",
  },
  connectBtn: {
    width: "100%",
    background: "linear-gradient(135deg, #06b6d4, #0284c7)",
    border: "none", borderRadius: 14, padding: "16px 0",
    color: "#000", fontWeight: 800, fontSize: 16, cursor: "pointer",
    transition: "all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
    boxShadow: "0 4px 24px rgba(6,182,212,0.35)",
  },
  btnInner: { display: "flex", alignItems: "center", justifyContent: "center", gap: 10 },
  networkNote: { fontSize: 12, color: "#334155", margin: 0, letterSpacing: "0.03em" },
};