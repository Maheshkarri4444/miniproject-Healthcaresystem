import { BrowserRouter, Routes, Route } from "react-router-dom";
import AuthGate from "./pages/AutoGate";
import SelectRole from "./pages/SelectRole";
import DoctorRegister from "./pages/DoctorRegister";
import DoctorDashboard from "./pages/DoctorDashboard";
import UserDashboard from "./pages/UserDashboard";
import UserRegister from "./pages/UserRegister";
import AdminPanel from "./pages/AdminPanel";
import { GenerateAdminKeys } from "./components/GenerateAdminKeys";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AuthGate />} />
        <Route path="/select-role" element={<SelectRole />} />
        <Route path="/doctor/register" element={<DoctorRegister />} />
        <Route path="/user/register" element={<UserRegister />} />
        <Route path="/doctor/dashboard" element={<DoctorDashboard />} />
        <Route path="/user/dashboard" element={<UserDashboard />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/genkeys" element={<GenerateAdminKeys />} />
        <Route path="/ai-prediction" element={<AIPredictionPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;