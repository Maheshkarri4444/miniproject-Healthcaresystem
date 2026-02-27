import { useState } from "react";
import { getContract, connectWallet } from "../utils/contract";

export default function DoctorRegister() {
  const [form, setForm] = useState({
    name: "",
    phoneNumber: "",
    email: "",
  });

  const [docs, setDocs] = useState([]);

  const handleSubmit = async () => {
    try {
      const wallet = await connectWallet();
      const contract = await getContract();

      // 1️⃣ Call Backend (fetch)
      await fetch("http://localhost:5000/api/doctors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pubkey: wallet,
          ...form,
          docs,
        }),
      });

      // 2️⃣ Call Smart Contract
      const tx = await contract.registerDoctor(docs);
      await tx.wait();

      alert("Doctor Registered!");
    } catch (err) {
      console.error(err);
      alert("Error registering doctor");
    }
  };

  return (
    <div>
      <h2>Doctor Registration</h2>

      <input
        placeholder="Name"
        onChange={(e) => setForm({ ...form, name: e.target.value })}
      />

      <input
        placeholder="Phone"
        onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
      />

      <input
        placeholder="Email"
        onChange={(e) => setForm({ ...form, email: e.target.value })}
      />

      <input
        placeholder="IPFS Doc Link"
        onChange={(e) => setDocs([...docs, e.target.value])}
      />

      <button onClick={handleSubmit}>Submit</button>
    </div>
  );
}