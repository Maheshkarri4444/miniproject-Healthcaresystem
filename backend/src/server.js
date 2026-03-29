const express = require("express");
const cors = require("cors");
require("dotenv").config();

const connectDB = require("./config/db");

const userRoutes    = require("./routes/userRoutes");
const doctorRoutes  = require("./routes/doctorRoutes");
const ipfsRoutes    = require("./routes/ipfsRoutes");
const medicalRoutes = require("./routes/medicalRecords");
const requestRoutes = require("./routes/requestRoutes"); // ← NEW

const app = express();

connectDB();

app.use(cors());
app.use(express.json());

app.use("/api/users",    userRoutes);
app.use("/api/doctors",  doctorRoutes);
app.use("/api/ipfs",     ipfsRoutes);
app.use("/api/records",  medicalRoutes);
app.use("/api/requests", requestRoutes); // ← NEW

const PORT = process.env.PORT || 5010;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));