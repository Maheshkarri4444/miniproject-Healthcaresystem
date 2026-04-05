import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

const API = "http://localhost:8000";

const ENV_OPTIONS = {
  temperature:   ["low", "medium", "high"],
  humidity:      ["low", "medium", "high"],
  air_quality:   ["bad", "normal", "good"],
  water_quality: ["bad", "normal", "good"],
  region_type:   ["urban", "rural", "coastal", "mountain", "tropical", "desert", "forest", "river_basin", "grassland", "dry", "cold", "temperate"],
  weather:       ["sunny", "cloudy", "rainy", "snowy", "windy", "foggy", "stormy", "sweaty", "humid"],
  time_delay:    ["recent", "moderate", "long"],
};

const CLINICAL_FIELDS = [
  { key: "age",         label: "Age",            unit: "yrs",   min: 1,   max: 100,  step: 1,   default: 30,   icon: "👤" },
  { key: "weight",      label: "Weight",          unit: "kg",    min: 30,  max: 150,  step: 1,   default: 60,   icon: "⚖️" },
  { key: "bp",          label: "Blood Pressure",  unit: "mmHg",  min: 60,  max: 200,  step: 1,   default: 120,  icon: "💓" },
  { key: "sugar",       label: "Blood Sugar",     unit: "mg/dL", min: 50,  max: 300,  step: 1,   default: 100,  icon: "🍬" },
  { key: "cholesterol", label: "Cholesterol",     unit: "mg/dL", min: 10,  max: 300,  step: 1,   default: 180,  icon: "🧪" },
  { key: "wbc",         label: "WBC Count",       unit: "k/μL",  min: 2,   max: 20,   step: 1,   default: 6,    icon: "🔬" },
  { key: "bmi",         label: "BMI",             unit: "",      min: 5,   max: 40,   step: 0.1, default: 22.0, icon: "📊" },
  { key: "sleep",       label: "Sleep",           unit: "hrs",   min: 0,   max: 12,   step: 1,   default: 7,    icon: "🌙" },
];

const ENV_META = {
  temperature:   { label: "Temperature",     icon: "🌡️" },
  humidity:      { label: "Humidity",         icon: "💧" },
  air_quality:   { label: "Air Quality",      icon: "💨" },
  water_quality: { label: "Water Quality",    icon: "🚿" },
  region_type:   { label: "Region Type",      icon: "🌍" },
  weather:       { label: "Weather",          icon: "⛅" },
  time_delay:    { label: "Symptom Duration", icon: "⏳" },
};

const QUICK_SYMPTOMS = ["fever", "headache", "cough", "fatigue", "nausea", "vomiting", "chest pain", "breathlessness", "body ache", "sore throat"];

function riskMeta(pct) {
  if (pct >= 50) return { color: "#ef4444", bg: "rgba(239,68,68,0.10)",  border: "rgba(239,68,68,0.28)",  label: "High Risk", bar: "linear-gradient(90deg,#ef444480,#ef4444)" };
  if (pct >= 25) return { color: "#f59e0b", bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.28)", label: "Moderate",  bar: "linear-gradient(90deg,#f59e0b80,#f59e0b)" };
  return           { color: "#10b981", bg: "rgba(16,185,129,0.10)",  border: "rgba(16,185,129,0.28)",  label: "Low Risk",  bar: "linear-gradient(90deg,#10b98180,#10b981)" };
}

function Spinner({ color = "#8b5cf6", size = 16 }) {
  return <span style={{ width: size, height: size, border: `2px solid ${color}25`, borderTopColor: color, borderRadius: "50%", display: "inline-block", animation: "spin .7s linear infinite", flexShrink: 0 }} />;
}

function SLabel({ icon, text }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.09em" }}>{text}</span>
      <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.05)" }} />
    </div>
  );
}

export default function AIPredictionPage() {
  const navigate     = useNavigate();
  const { state }    = useLocation();
  const initClinical = Object.fromEntries(CLINICAL_FIELDS.map(f => [f.key, f.default]));
  const initEnv = { temperature: "medium", humidity: "medium", air_quality: "normal", water_quality: "good", region_type: "urban", weather: "sunny", time_delay: "moderate" };

  const [symptoms, setSymptoms] = useState("");
  const [clinical, setClinical] = useState(initClinical);
  const [env, setEnv]           = useState(initEnv);
  const [loading, setLoading]   = useState(false);
  const [results, setResults]   = useState(null);
  const [error, setError]       = useState("");
  const [showClinical, setShowClinical] = useState(true);
  const [showEnv, setShowEnv]           = useState(true);

  const addSymptom = (s) => setSymptoms(prev => prev ? `${prev}, ${s}` : s);

  const handlePredict = async () => {
    if (!symptoms.trim()) { setError("Please describe at least one symptom."); return; }
    setLoading(true); setError(""); setResults(null);
    try {
      const res  = await fetch(`${API}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symptoms: symptoms.trim(), ...clinical, ...env }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Prediction failed");
      setResults(data.data);
      setTimeout(() => document.getElementById("results-anchor")?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (e) {
      setError(e.message || "Could not reach the AI server.");
    }
    setLoading(false);
  };

  const handleReset = () => {
    setSymptoms(""); setClinical(initClinical); setEnv(initEnv);
    setResults(null); setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div style={S.root}>
      <div style={S.orb1} /><div style={S.orb2} />
      <div style={S.grid} />

      <div style={S.wrap}>

        {/* NAV */}
        <nav style={S.nav}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button
              style={{ display: "flex", alignItems: "center", gap: 7, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#94a3b8", padding: "6px 14px", borderRadius: 9, cursor: "pointer", fontSize: 13, fontFamily: "inherit", fontWeight: 600 }}
                onClick={() => navigate(-1)}>
              ← Back
            </button>
            <span style={S.logo}>Health<span style={{ color: "#8b5cf6" }}>Chain</span></span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <span style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.22)", color: "#8b5cf6", padding: "5px 12px", borderRadius: 100, fontSize: 12 }}>⬡ Sepolia</span>
            <span style={{ background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.22)", color: "#06b6d4", padding: "5px 12px", borderRadius: 100, fontSize: 12 }}>🧬 AI Prediction</span>
          </div>
        </nav>

        {/* HERO */}
        <div style={S.hero}>
          <div style={S.heroIcon}>🧬</div>
          <div>
            <h1 style={S.heroH}>Disease Risk Prediction</h1>
            <p style={S.heroP}>Enter your symptoms, clinical data, and environment — our ensemble ML model predicts your risk instantly.</p>
          </div>
        </div>

        {/* ══ 1. SYMPTOMS ══ */}
        <div style={S.card}>
          <SLabel icon="🤒" text="Describe Your Symptoms" />
          <textarea
            style={S.ta}
            placeholder="e.g. headache, fever, sore throat, fatigue, nausea…"
            rows={4}
            value={symptoms}
            onChange={e => { setSymptoms(e.target.value); setError(""); }}
            disabled={loading}
          />
          <p style={{ fontSize: 11, color: "#334155", margin: "6px 0 14px", lineHeight: 1.5 }}>
            Separate with commas. The AI understands partial and misspelled terms.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {QUICK_SYMPTOMS.map(s => (
              <button key={s} style={S.chip} onClick={() => addSymptom(s)} disabled={loading}>+ {s}</button>
            ))}
          </div>
        </div>

        {/* ══ 2. CLINICAL ══ */}
        <div style={S.card}>
          <button style={S.accHead} onClick={() => setShowClinical(v => !v)}>
            <SLabel icon="🏥" text="Clinical Biomarkers" />
            <span style={{ color: "#475569", fontSize: 13, marginLeft: "auto", marginBottom: 14 }}>{showClinical ? "▲" : "▼"}</span>
          </button>
          {showClinical && (
            <div style={S.clinGrid}>
              {CLINICAL_FIELDS.map(f => {
                const val = clinical[f.key];
                const pct = Math.round(((val - f.min) / (f.max - f.min)) * 100);
                return (
                  <div key={f.key} style={S.sCard}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <span style={{ fontSize: 15 }}>{f.icon}</span>
                      <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600, flex: 1 }}>{f.label}</span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: "#c4b5fd" }}>
                        {f.step < 1 ? val.toFixed(1) : val}
                        <span style={{ fontSize: 10, color: "#475569", marginLeft: 2 }}>{f.unit}</span>
                      </span>
                    </div>
                    <input type="range" min={f.min} max={f.max} step={f.step} value={val}
                      onChange={e => setClinical(p => ({ ...p, [f.key]: f.step < 1 ? parseFloat(e.target.value) : parseInt(e.target.value) }))}
                      style={{ width: "100%", background: `linear-gradient(to right,#8b5cf6 ${pct}%,rgba(255,255,255,0.08) ${pct}%)` }}
                      disabled={loading}
                    />
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                      <span style={{ fontSize: 10, color: "#334155" }}>{f.min}</span>
                      <span style={{ fontSize: 10, color: "#334155" }}>{f.max}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ══ 3. ENVIRONMENTAL ══ */}
        <div style={S.card}>
          <button style={S.accHead} onClick={() => setShowEnv(v => !v)}>
            <SLabel icon="🌍" text="Environmental Factors" />
            <span style={{ color: "#475569", fontSize: 13, marginLeft: "auto", marginBottom: 14 }}>{showEnv ? "▲" : "▼"}</span>
          </button>
          {showEnv && (
            <div style={S.envGrid}>
              {Object.entries(ENV_META).map(([key, { label, icon }]) => (
                <div key={key} style={S.envBox}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 9 }}>
                    <span style={{ fontSize: 14 }}>{icon}</span>
                    <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>{label}</span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {ENV_OPTIONS[key].map(opt => {
                      const sel = env[key] === opt;
                      return (
                        <button key={opt} style={{
                          border: "1px solid", borderRadius: 8, padding: "4px 10px", fontSize: 11,
                          cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
                          background:  sel ? "rgba(139,92,246,0.18)" : "rgba(255,255,255,0.03)",
                          borderColor: sel ? "rgba(139,92,246,0.5)"  : "rgba(255,255,255,0.07)",
                          color:       sel ? "#c4b5fd" : "#64748b",
                          fontWeight:  sel ? 700 : 400,
                        }} onClick={() => setEnv(p => ({ ...p, [key]: opt }))} disabled={loading}>
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ERROR */}
        {error && (
          <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12, padding: "12px 16px", color: "#fca5a5", fontSize: 13, display: "flex", gap: 10, alignItems: "center" }}>
            <span>⚠️</span><span>{error}</span>
          </div>
        )}

        {/* CTA */}
        <div style={{ display: "flex", gap: 10 }}>
          <button style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "linear-gradient(135deg,#8b5cf6,#6d28d9)", border: "none", borderRadius: 12, padding: "15px 0", color: "#fff", fontWeight: 800, fontSize: 16, fontFamily: "inherit", opacity: loading ? 0.65 : 1, cursor: loading ? "wait" : "pointer" }}
            onClick={handlePredict} disabled={loading}>
            {loading ? <><Spinner color="#fff" size={16} />&nbsp;&nbsp;Analyzing…</> : <><span>🔍</span>&nbsp;&nbsp;Analyze & Predict</>}
          </button>
          <button style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#64748b", padding: "14px 20px", borderRadius: 12, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}
            onClick={handleReset} disabled={loading}>↺ Reset</button>
        </div>

        {/* LOADING BANNER */}
        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 14, background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.2)", borderRadius: 12, padding: "14px 18px" }}>
            <Spinner color="#8b5cf6" size={20} />
            <div>
              <div style={{ color: "#c4b5fd", fontWeight: 700, fontSize: 14 }}>Running AI Models…</div>
              <div style={{ color: "#475569", fontSize: 12, marginTop: 2 }}>Symptom matching · Clinical analysis · Environmental scoring</div>
            </div>
          </div>
        )}

        {/* ══ 4. RESULTS (bottom) ══ */}
        <div id="results-anchor" />

        {results && (
          <>
            {/* Section divider */}
            <div style={{ display: "flex", alignItems: "center", margin: "4px 0" }}>
              <div style={{ flex: 1, height: 1, background: "rgba(139,92,246,0.15)" }} />
              <span style={{ color: "#8b5cf6", fontSize: 12, fontWeight: 700, padding: "0 14px", letterSpacing: "0.08em", textTransform: "uppercase" }}>Prediction Results</span>
              <div style={{ flex: 1, height: 1, background: "rgba(139,92,246,0.15)" }} />
            </div>

            {/* Predicted Conditions */}
            <div style={S.card}>
              <SLabel icon="🩺" text="Predicted Conditions" />
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {results.predictions.map((pred, i) => {
                  const meta = riskMeta(pred.risk_percentage);
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, border: "1px solid", borderRadius: 14, padding: "14px 16px", borderColor: meta.border, background: meta.bg }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0, background: i === 0 ? "rgba(139,92,246,0.15)" : "rgba(255,255,255,0.04)", color: i === 0 ? "#c4b5fd" : "#475569", borderColor: i === 0 ? "rgba(139,92,246,0.3)" : "rgba(255,255,255,0.08)" }}>
                        {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                          <span style={{ color: "#f0f4ff", fontWeight: 800, fontSize: 16 }}>{pred.disease}</span>
                          <span style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${meta.border}`, color: meta.color, padding: "2px 10px", borderRadius: 100, fontSize: 11, fontWeight: 700 }}>{meta.label}</span>
                        </div>
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                            <span style={{ fontSize: 11, color: "#64748b" }}>Risk Score</span>
                            <span style={{ fontSize: 14, fontWeight: 800, color: meta.color }}>{pred.risk_percentage.toFixed(1)}%</span>
                          </div>
                          <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${Math.min(pred.risk_percentage, 100)}%`, background: meta.bar, borderRadius: 3, transition: "width 0.9s cubic-bezier(.4,0,.2,1)" }} />
                          </div>
                        </div>
                        {pred.matched_symptom_names?.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
                            {pred.matched_symptom_names.map((s, j) => (
                              <span key={j} style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.22)", color: "#a78bfa", padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: 600 }}>{s.replace(/_/g, " ")}</span>
                            ))}
                          </div>
                        )}
                        <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 12 }}><span style={{ color: "#475569" }}>Symptoms matched: </span><strong style={{ color: "#94a3b8" }}>{pred.symptoms_matched_to_disease}</strong></span>
                          <span style={{ fontSize: 12 }}><span style={{ color: "#475569" }}>Severity factor: </span><strong style={{ color: "#94a3b8" }}>{pred.severity_factor.toFixed(2)}×</strong></span>
                        </div>
                        {pred.warning && (
                          <div style={{ marginTop: 8, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.22)", color: "#fbbf24", borderRadius: 8, padding: "7px 12px", fontSize: 12 }}>⚠️ {pred.warning}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Symptom Matches */}
            {results.matched_symptoms?.length > 0 && (
              <div style={S.card}>
                <SLabel icon="✅" text="Symptom Matches" />
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {results.matched_symptoms.map(([input, matched, score], i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 8, padding: "8px 12px", flexWrap: "wrap" }}>
                      <span style={{ color: "#64748b", fontSize: 12, fontStyle: "italic" }}>"{input}"</span>
                      <span style={{ color: "#334155", fontSize: 11 }}>→</span>
                      <span style={{ color: "#a78bfa", fontSize: 12, fontWeight: 600, flex: 1 }}>{matched.replace(/_/g, " ")}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: score >= 85 ? "#10b981" : score >= 70 ? "#f59e0b" : "#f87171" }}>{score.toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Unmatched */}
            {results.unmatched_symptoms?.length > 0 && (
              <div style={{ ...S.card, borderColor: "rgba(239,68,68,0.18)", background: "rgba(239,68,68,0.03)" }}>
                <SLabel icon="❌" text="Unrecognized Symptoms" />
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                  {results.unmatched_symptoms.map((s, i) => (
                    <span key={i} style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#fca5a5", padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: 600 }}>{s}</span>
                  ))}
                </div>
                <p style={{ color: "#475569", fontSize: 12, margin: 0, lineHeight: 1.6 }}>These terms weren't found in the dataset. Try rephrasing or using more common medical terms.</p>
              </div>
            )}

            {/* Disclaimer */}
            <div style={{ ...S.card, flexDirection: "row", display: "flex", alignItems: "flex-start", gap: 12 }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>⚕️</span>
              <span style={{ fontSize: 12, color: "#475569", lineHeight: 1.7 }}>
                This is an AI-based screening tool, <strong style={{ color: "#64748b" }}>not a medical diagnosis</strong>. Always consult a qualified healthcare professional for proper diagnosis and treatment.
              </span>
            </div>

            <button style={{ width: "100%", display: "flex", justifyContent: "center", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#64748b", padding: "14px 20px", borderRadius: 12, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}
              onClick={handleReset}>↺ Start New Analysis</button>
          </>
        )}

      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        textarea { font-family: 'DM Sans','Segoe UI',sans-serif; color: #f0f4ff; }
        textarea::placeholder { color: #334155; }
        textarea:focus { outline: none; border-color: rgba(139,92,246,0.4) !important; }
        input[type=range] { -webkit-appearance: none; appearance: none; height: 4px; border-radius: 2px; cursor: pointer; border: none; outline: none; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; border-radius: 50%; background: #8b5cf6; border: 2px solid #060a12; cursor: pointer; box-shadow: 0 0 0 3px rgba(139,92,246,0.2); }
        input[type=range]::-moz-range-thumb { width: 16px; height: 16px; border-radius: 50%; background: #8b5cf6; border: 2px solid #060a12; cursor: pointer; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-thumb { background: rgba(139,92,246,0.25); border-radius: 2px; }
      `}</style>
    </div>
  );
}

const S = {
  root:    { minHeight: "100vh", background: "#060a12", fontFamily: "'DM Sans','Segoe UI',sans-serif", color: "#f0f4ff", position: "relative", overflowX: "hidden" },
  orb1:    { position: "fixed", top: "-8%", right: "-6%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle,rgba(139,92,246,0.10) 0%,transparent 70%)", pointerEvents: "none", zIndex: 0 },
  orb2:    { position: "fixed", bottom: "-10%", left: "-5%", width: 560, height: 560, borderRadius: "50%", background: "radial-gradient(circle,rgba(6,182,212,0.07) 0%,transparent 70%)", pointerEvents: "none", zIndex: 0 },
  grid:    { position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, backgroundImage: "linear-gradient(rgba(139,92,246,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(139,92,246,0.02) 1px,transparent 1px)", backgroundSize: "60px 60px" },
  wrap:    { maxWidth: 820, margin: "0 auto", padding: "0 24px 80px", position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 16 },
  nav:     { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "22px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" },
  logo:    { fontSize: 22, fontWeight: 800, color: "#f0f4ff", letterSpacing: "-0.5px" },
  hero:    { display: "flex", alignItems: "center", gap: 16, margin: "28px 0 4px" },
  heroIcon:{ width: 60, height: 60, borderRadius: 16, background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.22)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, flexShrink: 0 },
  heroH:   { fontSize: 24, fontWeight: 800, color: "#f0f4ff", margin: "0 0 5px" },
  heroP:   { fontSize: 13, color: "#64748b", margin: 0, lineHeight: 1.7 },
  card:    { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 18, padding: "22px 22px 18px" },
  accHead: { display: "flex", alignItems: "flex-start", width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0, color: "inherit", fontFamily: "inherit" },
  ta:      { width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "14px 16px", fontSize: 14, lineHeight: 1.6, resize: "vertical" },
  chip:    { background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.22)", color: "#a78bfa", padding: "4px 11px", borderRadius: 20, fontSize: 12, cursor: "pointer", fontFamily: "inherit" },
  clinGrid:{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  sCard:   { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: "12px 14px" },
  envGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 },
  envBox:  { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: "12px 14px" },
};