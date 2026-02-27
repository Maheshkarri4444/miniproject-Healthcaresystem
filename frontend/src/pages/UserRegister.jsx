import { useState } from "react";
import { connectWallet } from "../utils/contract";

export default function UserRegister() {
  const [form, setForm] = useState({
    name: "",
    phoneNumber: "",
    email: "",
  });

  const handleSubmit = async () => {
    try {
      const wallet = await connectWallet();

      await fetch("http://localhost:5000/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pubkey: wallet,
          ...form,
        }),
      });

      alert("User Registered!");
    } catch (err) {
      console.error(err);
      alert("Error");
    }
  };

  return (
    <div>
      <h2>User Registration</h2>

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

      <button onClick={handleSubmit}>Submit</button>
    </div>
  );
}