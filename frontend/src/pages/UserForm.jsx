import { useState } from "react";

export default function UserForm() {
  const [form, setForm] = useState({
    name: "",
    phoneNumber: "",
    email: "",
  });

  const handleSubmit = async () => {
    const accounts = await window.ethereum.request({
      method: "eth_accounts",
    });

    const wallet = accounts[0];

    await fetch("http://localhost:5010/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pubkey: wallet,
        ...form,
      }),
    });

    alert("User Created");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <h2 className="text-2xl font-bold">User Registration</h2>

      <input className="border p-2" placeholder="Name"
        onChange={(e)=>setForm({...form,name:e.target.value})} />

      <input className="border p-2" placeholder="Phone"
        onChange={(e)=>setForm({...form,phoneNumber:e.target.value})} />

      <input className="border p-2" placeholder="Email"
        onChange={(e)=>setForm({...form,email:e.target.value})} />

      <button
        onClick={handleSubmit}
        className="px-6 py-2 bg-green-600 text-white rounded"
      >
        Submit
      </button>
    </div>
  );
}