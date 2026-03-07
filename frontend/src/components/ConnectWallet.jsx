export default function ConnectWallet({ onConnected }) {
  const connect = async () => {
    if (!window.ethereum) {
      alert("Install MetaMask");
      return;
    }

    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    });

    onConnected(accounts[0]);
  };

  return (
    <button
      onClick={connect}
      className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
    >
      Connect MetaMask
    </button>
  );
}