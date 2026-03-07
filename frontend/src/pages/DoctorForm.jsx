import { useState } from "react";
import { getContract } from "../utils/contract";
import { encryptFile } from "../utils/crypto";

export default function DoctorForm() {
  const [form, setForm] = useState({
    name: "",
    phoneNumber: "",
    email: "",
  });

  const [files, setFiles] = useState([]);

  const handleSubmit = async () => {
    try {
      const accounts = await window.ethereum.request({
        method: "eth_accounts",
      });

      const wallet = accounts[0];
      const contract = await getContract();

      const ipfsHashes = [];

      for (let file of files) {
        const { encryptedBlob } = await encryptFile(file);

        const formData = new FormData();
        formData.append("file", encryptedBlob);

        const upload = await fetch(
          "http://localhost:5000/api/ipfs/upload",
          {
            method: "POST",
            body: formData,
          }
        );

        const result = await upload.json();
        ipfsHashes.push(result.cid);
      }

      // Call backend createDoctor
      await fetch("http://localhost:5000/api/doctors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pubkey: wallet,
          ...form,
          docs: ipfsHashes,
        }),
      });

      // Call blockchain
      const tx = await contract.registerDoctor(ipfsHashes);
      await tx.wait();

      alert("Doctor Registered Successfully");
    } catch (err) {
      console.error(err);
      alert("Error");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <h2 className="text-2xl font-bold">Doctor Registration</h2>

      <input
        className="border p-2"
        placeholder="Name"
        onChange={(e) => setForm({ ...form, name: e.target.value })}
      />

      <input
        className="border p-2"
        placeholder="Phone"
        onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
      />

      <input
        className="border p-2"
        placeholder="Email"
        onChange={(e) => setForm({ ...form, email: e.target.value })}
      />

      <input
        type="file"
        multiple
        onChange={(e) => setFiles([...e.target.files])}
      />

      <button
        onClick={handleSubmit}
        className="px-6 py-2 bg-blue-600 text-white rounded"
      >
        Submit
      </button>
    </div>
  );
}