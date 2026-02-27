import { BrowserRouter, Routes, Route } from "react-router-dom";
import SelectRole from "./pages/SelectRole";
import DoctorRegister from "./pages/DoctorRegister";
import UserRegister from "./pages/UserRegister";
import AdminPanel from "./pages/AdminPanel";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SelectRole />} />
        <Route path="/doctor" element={<DoctorRegister />} />
        <Route path="/user" element={<UserRegister />} />
        <Route path="/admin" element={<AdminPanel />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;