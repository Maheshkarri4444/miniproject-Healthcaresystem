const Doctor = require("../models/Doctor");
const DoctorRegistryABI = require("../abi/DoctorRegistryABI.json");

const getAdminContract = () => {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const adminWallet = new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY, provider);
  return new ethers.Contract(
    process.env.CONTRACT_ADDRESS,
    DoctorRegistryABI,
    adminWallet
  );
};
exports.createDoctor = async (req, res) => {
  try {
    const doctor = await Doctor.create(req.body);
    // console.log("body: ",doctor);
    res.status(201).json(doctor);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.addDocs = async (req, res) => {
  const doctor = await Doctor.findOne({ pubkey: req.params.pubkey });
  if (!doctor) return res.status(404).json({ message: "Doctor not found" });

  doctor.docs.push(...req.body.docs);
  await doctor.save();

  res.json(doctor);
};

exports.getAllDoctors = async (req, res) => {
  const doctors = await Doctor.find();
  res.json(doctors);
};

exports.getDoctorByAddress = async (req, res) => {
  try {
    const doctor = await Doctor.findOne({
      walletAddress: req.params.address,
    });
    console.log("address:",req.params.address.toLowerCase())
    if (!doctor) return res.status(404).json({ error: "Doctor not found" });
    res.json(doctor);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.verifyDoctor = async (req, res) => {
  try {
    const { address } = req.params;
    const contract = getAdminContract();
    const tx = await contract.verifyDoctor(address);
    await tx.wait();
    res.json({ success: true, txHash: tx.hash });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};