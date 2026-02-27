import { useNavigate } from "react-router-dom";
import { connectWallet } from "../utils/contract";

const ADMIN_WALLET = import.meta.env.VITE_ADMIN_WALLET;

export default function SelectRole() {
  const navigate = useNavigate();

  const handleLogin = async (role) => {
    const wallet = await connectWallet();
    if (!wallet) return;

    if (wallet.toLowerCase() === ADMIN_WALLET.toLowerCase()) {
      navigate("/admin");
      return;
    }

    navigate(`/${role}`);
  };

  return (
    <div>
      <h2>Select Role</h2>
      <button onClick={() => handleLogin("doctor")}>Doctor</button>
      <button onClick={() => handleLogin("user")}>User</button>
    </div>
  );
}