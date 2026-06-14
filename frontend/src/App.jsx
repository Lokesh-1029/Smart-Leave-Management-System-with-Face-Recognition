import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Toaster, toast } from "react-hot-toast";
import Webcam from "react-webcam";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

const API = axios.create({ baseURL: "http://localhost:5000/api" });
API.interceptors.request.use((req) => {
  const token = localStorage.getItem("token");
  if (token) req.headers.Authorization = token;
  return req;
});

// Voice Alert
const speak = (message) => {
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.rate = 0.9;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }
};

// Password Strength Meter
function PasswordStrengthMeter({ password }) {
  const [strength, setStrength] = useState({ level: '', color: '#e5e7eb', percentage: 0 });

  useEffect(() => {
    if (!password) {
      setStrength({ level: '', color: '#e5e7eb', percentage: 0 });
      return;
    }
    let score = 0;
    if (password.length >= 6) score++;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    
    if (score <= 2) setStrength({ level: 'Weak', color: '#ef4444', percentage: 25 });
    else if (score <= 4) setStrength({ level: 'Medium', color: '#f59e0b', percentage: 60 });
    else setStrength({ level: 'Strong', color: '#10b981', percentage: 100 });
  }, [password]);

  if (!password) return null;
  return (
    <div className="mt-1">
      <div className="h-1 w-full bg-gray-200 rounded-full overflow-hidden">
        <div className="h-full transition-all duration-300" style={{ width: `${strength.percentage}%`, backgroundColor: strength.color }} />
      </div>
      <p className="text-xs mt-1" style={{ color: strength.color }}>{strength.level}</p>
    </div>
  );
}

// Face Register Component - Simple Version
function FaceRegister({ onRegister, onBack }) {
  const webcamRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [imgSrc, setImgSrc] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", department: "" });

  const capture = () => {
    if (!webcamRef.current) return;
    const imageSrc = webcamRef.current.getScreenshot();
    if (imageSrc) {
      setImgSrc(imageSrc);
      toast.success("Face captured!");
    } else {
      toast.error("Capture failed");
    }
  };

  const retake = () => setImgSrc(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!imgSrc) {
      toast.error("Please capture your face first");
      return;
    }
    
    setLoading(true);
    try {
      const blob = await (await fetch(imgSrc)).blob();
      const formData = new FormData();
      formData.append("face", blob, "face.jpg");
      formData.append("name", form.name);
      formData.append("email", form.email);
      formData.append("password", form.password);
      formData.append("department", form.department);
      
      const res = await API.post("/auth/register-with-face", formData);
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));
      toast.success("Registration successful!");
      onRegister(res.data.user);
    } catch (error) {
      toast.error(error.response?.data?.error || "Registration failed");
    }
    setLoading(false);
  };

  return (
    <div className="bg-white p-8 rounded-lg shadow-md w-96 max-h-[90vh] overflow-auto">
      <h2 className="text-2xl font-bold mb-4 text-center text-purple-600">Register with Face</h2>
      
      {!imgSrc ? (
        <>
          <div className="text-center text-sm text-gray-500 mb-2">📸 Look at camera & click Capture</div>
          <Webcam ref={webcamRef} screenshotFormat="image/jpeg" className="rounded-lg border w-full mb-3" mirrored />
          <button onClick={capture} className="w-full bg-purple-600 text-white p-2 rounded-lg">📸 Capture Face</button>
        </>
      ) : (
        <>
          <img src={imgSrc} alt="Captured" className="rounded-lg border w-full mb-3" />
          <form onSubmit={handleSubmit} className="space-y-2">
            <input type="text" placeholder="Full Name" className="w-full p-2 border rounded" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <input type="email" placeholder="Email" className="w-full p-2 border rounded" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            <input type="password" placeholder="Password (min 6 chars)" className="w-full p-2 border rounded" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            <select className="w-full p-2 border rounded" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} required>
              <option value="">Select Department</option>
              <option value="IT">IT</option>
              <option value="Software Technician">Software Technician</option>
              <option value="HR">HR</option>
              <option value="Finance">Finance</option>
            </select>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={retake} className="flex-1 bg-yellow-600 text-white p-2 rounded">Retake</button>
              <button type="submit" disabled={loading} className="flex-1 bg-green-600 text-white p-2 rounded">{loading ? "Registering..." : "Register"}</button>
            </div>
          </form>
        </>
      )}
      <button onClick={onBack} className="w-full mt-3 text-blue-600">← Back to Login</button>
    </div>
  );
}

// Face Login Component - Simple Version
function FaceLogin({ onLogin, onBack }) {
  const webcamRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [imgSrc, setImgSrc] = useState(null);

  const capture = () => {
    if (!webcamRef.current) return;
    const imageSrc = webcamRef.current.getScreenshot();
    if (imageSrc) {
      setImgSrc(imageSrc);
      toast.success("Face captured! Click Login.");
    } else {
      toast.error("Capture failed");
    }
  };

  const retake = () => setImgSrc(null);

  const handleLogin = async () => {
    if (!imgSrc) {
      toast.error("Please capture your face first");
      return;
    }
    
    setLoading(true);
    try {
      const blob = await (await fetch(imgSrc)).blob();
      const formData = new FormData();
      formData.append("face", blob, "face.jpg");
      
      const res = await API.post("/auth/face-login", formData);
      
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));
      toast.success(`Welcome ${res.data.user.name}!`);
      onLogin(res.data.user);
    } catch (error) {
      toast.error(error.response?.data?.error || "Face login failed");
    }
    setLoading(false);
  };

  return (
    <div className="bg-white p-8 rounded-lg shadow-md w-96">
      <h2 className="text-2xl font-bold mb-4 text-center text-purple-600">Face Login</h2>
      
      {!imgSrc ? (
        <>
          <Webcam ref={webcamRef} screenshotFormat="image/jpeg" className="rounded-lg border w-full mb-3" mirrored />
          <button onClick={capture} className="w-full bg-purple-600 text-white p-2 rounded-lg">📸 Capture Photo</button>
        </>
      ) : (
        <>
          <img src={imgSrc} alt="Captured" className="rounded-lg border w-full mb-3" />
          <div className="flex gap-2">
            <button onClick={retake} className="flex-1 bg-yellow-600 text-white p-2 rounded">Retake</button>
            <button onClick={handleLogin} disabled={loading} className="flex-1 bg-green-600 text-white p-2 rounded">
              {loading ? "Logging in..." : "Login"}
            </button>
          </div>
        </>
      )}
      
      <button onClick={onBack} className="w-full mt-3 text-blue-600">← Back to Email Login</button>
    </div>
  );
}

// Login Component
function Login({ onLogin, onShowFaceLogin, onShowRegister }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [userDetails, setUserDetails] = useState(null);
  const [isAdminLogin, setIsAdminLogin] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetStep, setResetStep] = useState(1);

  useEffect(() => {
    const savedEmail = localStorage.getItem("savedEmail");
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const endpoint = isAdminLogin ? "/auth/admin-login" : "/auth/login";
      const res = await API.post(endpoint, { email, password });
      localStorage.setItem("token", res.data.token);
      if (rememberMe) localStorage.setItem("savedEmail", email);
      else localStorage.removeItem("savedEmail");
      setUserDetails(res.data.user);
      setShowVerification(true);
      toast.success("Please verify your details");
    } catch (error) {
      toast.error(error.response?.data?.error || "Invalid credentials");
    }
    setLoading(false);
  };

  const handleForgotPassword = async () => {
    setLoading(true);
    try {
      const res = await API.post("/auth/forgot-password", { email: resetEmail });
      setResetToken(res.data.resetToken);
      setResetStep(2);
      toast.success("Reset token generated");
    } catch (error) {
      toast.error(error.response?.data?.error || "Email not found");
    }
    setLoading(false);
  };

  const handleResetPassword = async () => {
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      await API.post("/auth/reset-password", { token: resetToken, newPassword });
      toast.success("Password reset successful! Please login.");
      setShowForgotPassword(false);
      setResetStep(1);
      setResetEmail("");
      setNewPassword("");
    } catch (error) {
      toast.error("Failed to reset password");
    }
    setLoading(false);
  };

  const handleConfirmDetails = async () => {
    if (userDetails?.isNewUser) {
      speak("Welcome to Good Friends Association! Please complete your profile.");
    } else {
      speak(`Welcome back ${userDetails.name}.`);
    }
    onLogin(userDetails);
    
    const welcomeDiv = document.createElement('div');
    welcomeDiv.className = 'fixed inset-0 bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center z-50';
    welcomeDiv.innerHTML = `<div class="text-center text-white"><h1 class="text-5xl font-bold mb-4">${userDetails?.isNewUser ? '🎉 New Member!' : 'Welcome Back!'}</h1><p class="text-xl">${userDetails.name}</p><p class="text-lg mt-2">Good Friends Association</p><div class="mt-6 w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto"></div></div>`;
    document.body.appendChild(welcomeDiv);
    setTimeout(() => welcomeDiv.remove(), 2000);
  };

  if (showForgotPassword) {
    return (
      <div className="bg-white p-8 rounded-lg shadow-md w-96">
        <h2 className="text-2xl font-bold mb-6 text-center text-blue-600">Reset Password</h2>
        {resetStep === 1 ? (
          <>
            <input type="email" placeholder="Enter your email" className="w-full p-3 border rounded-lg mb-4" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} required />
            <button onClick={handleForgotPassword} disabled={loading} className="w-full bg-blue-600 text-white p-3 rounded-lg">Send Reset Link</button>
          </>
        ) : (
          <>
            <input type="password" placeholder="New Password (min 6 chars)" className="w-full p-3 border rounded-lg mb-4" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
            <button onClick={handleResetPassword} disabled={loading} className="w-full bg-green-600 text-white p-3 rounded-lg">Reset Password</button>
          </>
        )}
        <button onClick={() => { setShowForgotPassword(false); setResetStep(1); }} className="w-full mt-3 text-gray-500 text-sm">← Back to Login</button>
      </div>
    );
  }

  if (showVerification && userDetails) {
    return (
      <div className="bg-white p-8 rounded-lg shadow-md w-96">
        <h2 className="text-2xl font-bold mb-6 text-center text-blue-600">Verify Your Details</h2>
        <div className="space-y-3 mb-6">
          <div className="p-3 bg-gray-50 rounded-lg"><p className="text-sm text-gray-500">Name</p><p className="font-semibold">{userDetails.name}</p></div>
          <div className="p-3 bg-gray-50 rounded-lg"><p className="text-sm text-gray-500">Employee ID</p><p className="font-semibold">{userDetails.employeeId}</p></div>
          <div className="p-3 bg-gray-50 rounded-lg"><p className="text-sm text-gray-500">Department</p><p className="font-semibold">{userDetails.department || 'Not assigned'}</p></div>
        </div>
        <button onClick={handleConfirmDetails} className="w-full bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700">Confirm & Continue</button>
        <button onClick={() => setShowVerification(false)} className="w-full mt-2 text-gray-500 text-sm">Edit Details</button>
      </div>
    );
  }

  return (
    <div className="bg-white/95 backdrop-blur-sm p-8 rounded-2xl shadow-2xl w-96 border border-gray-100">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-3"><span className="text-2xl text-white">🏢</span></div>
        <h2 className="text-2xl font-bold text-gray-800">Good Friends Association</h2>
        <p className="text-sm text-gray-500 mt-1">{isAdminLogin ? "Admin Login" : "Employee Login"}</p>
      </div>
      
      <div className="flex gap-2 mb-4">
        <button onClick={() => setIsAdminLogin(false)} className={`flex-1 p-2 rounded ${!isAdminLogin ? "bg-blue-600 text-white" : "bg-gray-200"}`}>Employee</button>
        <button onClick={() => setIsAdminLogin(true)} className={`flex-1 p-2 rounded ${isAdminLogin ? "bg-purple-600 text-white" : "bg-gray-200"}`}>Admin</button>
      </div>
      
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
          <input type="email" placeholder={isAdminLogin ? "admin@goodfriends.com" : "you@example.com"} className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-blue-500" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <div className="relative">
            <input type={showPassword ? "text" : "password"} placeholder="Enter your password" className="w-full p-3 border rounded-xl" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-gray-500">{showPassword ? "👁️" : "👁️‍🗨️"}</button>
          </div>
        </div>
        <div className="flex items-center justify-between mb-4">
          <label className="flex items-center"><input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="mr-2" /><span className="text-sm text-gray-600">Remember me</span></label>
          <button type="button" onClick={() => setShowForgotPassword(true)} className="text-sm text-blue-600 hover:underline">Forgot Password?</button>
        </div>
        <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white p-3 rounded-xl font-semibold hover:from-blue-700 disabled:opacity-50">{loading ? "Logging in..." : "Login"}</button>
      </form>
      
      {!isAdminLogin && (
        <div className="text-center mt-4">
          <div className="relative my-4"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-300"></div></div><div className="relative flex justify-center text-sm"><span className="px-2 bg-white text-gray-500">Or</span></div></div>
          <button onClick={onShowFaceLogin} className="w-full bg-purple-100 text-purple-700 p-3 rounded-xl font-semibold hover:bg-purple-200 flex items-center justify-center gap-2 mb-2">📸 Login with Face</button>
          <button onClick={onShowRegister} className="w-full bg-green-100 text-green-700 p-3 rounded-xl font-semibold hover:bg-green-200 flex items-center justify-center gap-2">📝 New User? Register with Face</button>
        </div>
      )}
      
      {isAdminLogin && (
        <div className="text-center mt-4 text-xs text-gray-400">
          <p>Demo Admin: admin@goodfriends.com / Admin@123</p>
        </div>
      )}
    </div>
  );
}

// ============ REST OF THE COMPONENTS (ApplyLeave, MyLeaves, Attendance, etc.) ============
// [Due to length, these remain the same as before - they work perfectly]

// Apply Leave Component
function ApplyLeave({ onLeaveApplied }) {
  const [form, setForm] = useState({ leaveType: "casual", fromDate: "", toDate: "", totalDays: 0, reason: "" });

  const calculateDays = (from, to) => {
    if (from && to) {
      const start = new Date(from);
      const end = new Date(to);
      const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
      setForm(prev => ({ ...prev, totalDays: diffDays > 0 ? diffDays : 0 }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.fromDate || !form.toDate) { toast.error("Please select both dates"); return; }
    if (new Date(form.fromDate) > new Date(form.toDate)) { toast.error("From date cannot be after to date"); return; }
    try {
      await API.post("/leave/apply", form);
      toast.success("Leave applied successfully!");
      setForm({ leaveType: "casual", fromDate: "", toDate: "", totalDays: 0, reason: "" });
      onLeaveApplied();
    } catch (error) { toast.error("Failed to apply leave"); }
  };

  const today = new Date().toISOString().split('T')[0];
  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4">Apply for Leave</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div><label className="block text-sm font-medium mb-1">Leave Type</label>
          <select className="w-full p-2 border rounded" value={form.leaveType} onChange={(e) => setForm({ ...form, leaveType: e.target.value })}>
            <option value="sick">Sick Leave</option><option value="casual">Casual Leave</option><option value="paid">Paid Leave</option><option value="emergency">Emergency Leave</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="block text-sm font-medium mb-1">From Date</label><input type="date" className="w-full p-2 border rounded" value={form.fromDate} min={today} onChange={(e) => { setForm({ ...form, fromDate: e.target.value }); calculateDays(e.target.value, form.toDate); }} required /></div>
          <div><label className="block text-sm font-medium mb-1">To Date</label><input type="date" className="w-full p-2 border rounded" value={form.toDate} min={form.fromDate || today} onChange={(e) => { setForm({ ...form, toDate: e.target.value }); calculateDays(form.fromDate, e.target.value); }} required disabled={!form.fromDate} /></div>
        </div>
        {form.totalDays > 0 && <div className="bg-blue-50 p-2 rounded"><p className="text-blue-600 font-semibold">Total Days: {form.totalDays}</p></div>}
        <div><label className="block text-sm font-medium mb-1">Reason</label><textarea className="w-full p-2 border rounded" rows="3" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} required /></div>
        <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded w-full">Submit Application</button>
      </form>
    </div>
  );
}

// My Leaves Component (Fixed)
function MyLeaves() {
  const [leaves, setLeaves] = useState([]);
  
  useEffect(() => {
    fetchLeaves();
  }, []);
  
  const fetchLeaves = async () => {
    try {
      const res = await API.get("/leave/my-leaves");
      setLeaves(res.data);
    } catch (error) {
      toast.error("Failed to fetch leaves");
    }
  };
  
  const handleCancel = async (id) => {
    if (window.confirm("Cancel this leave?")) {
      try {
        await API.delete(`/leave/cancel/${id}`);
        toast.success("Leave cancelled");
        fetchLeaves();
      } catch (error) {
        toast.error("Failed to cancel");
      }
    }
  };
  
  const getStatusColor = (status) => {
    if (status === "approved") return "bg-green-200 text-green-800";
    if (status === "rejected") return "bg-red-200 text-red-800";
    return "bg-yellow-200 text-yellow-800";
  };

  if (leaves.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">My Leave Applications</h2>
        <p>No leave applications found.</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4">My Leave Applications</h2>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">Type</th>
              <th className="p-2 text-left">From</th>
              <th className="p-2 text-left">To</th>
              <th className="p-2 text-left">Days</th>
              <th className="p-2 text-left">Status</th>
              <th className="p-2 text-left">Action</th>
            </tr>
          </thead>
          <tbody>
            {leaves.map((leave) => (
              <tr key={leave.id} className="border-b">
                <td className="p-2 capitalize">{leave.leaveType}</td>
                <td className="p-2">{new Date(leave.fromDate).toLocaleDateString()}</td>
                <td className="p-2">{new Date(leave.toDate).toLocaleDateString()}</td>
                <td className="p-2">{leave.totalDays}</td>
                <td className="p-2">
                  <span className={`px-2 py-1 rounded text-sm ${getStatusColor(leave.status)}`}>
                    {leave.status}
                  </span>
                </td>
                <td className="p-2">
                  {leave.status === "pending" && (
                    <button
                      onClick={() => handleCancel(leave.id)}
                      className="bg-red-500 text-white px-2 py-1 rounded text-sm"
                    >
                      Cancel
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Attendance Component (Fixed)
function Attendance() {
  const [todayStatus, setTodayStatus] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const OFFICE_START = "09:30 AM";
  const OFFICE_END = "06:30 PM";
  const REQUIRED_HOURS = 9;

  useEffect(() => {
    fetchToday();
    fetchHistory();
  }, []);

  const fetchToday = async () => {
    try {
      const res = await API.get("/attendance/today");
      setTodayStatus(res.data);
    } catch (error) {}
  };

  const fetchHistory = async () => {
    try {
      const res = await API.get("/attendance/my-attendance");
      setHistory(res.data);
    } catch (error) {}
  };

  const handleCheckIn = async () => {
    setLoading(true);
    try {
      await API.post("/attendance/checkin");
      toast.success(`Checked in at ${new Date().toLocaleTimeString()}`);
      fetchToday();
      fetchHistory();
    } catch (error) {
      toast.error("Check-in failed");
    }
    setLoading(false);
  };

  const handleCheckOut = async () => {
    setLoading(true);
    try {
      const res = await API.post("/attendance/checkout");
      toast.success(res.data.message);
      fetchToday();
      fetchHistory();
    } catch (error) {
      toast.error("Check-out failed");
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Office Timings Card */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <h3 className="font-bold text-blue-800">🏢 Office Timings</h3>
        <div className="grid grid-cols-2 gap-4 text-sm mt-2">
          <div>🕐 Start: <strong>{OFFICE_START}</strong></div>
          <div>🕕 End: <strong>{OFFICE_END}</strong></div>
          <div>⏱️ Required: <strong>{REQUIRED_HOURS} hours/day</strong></div>
          <div>🍽️ Break: <strong>1 hour</strong></div>
        </div>
      </div>

      {/* Today's Attendance Card */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">Today's Attendance</h2>
        <div className="flex gap-4 items-center">
          {!todayStatus?.checkedIn ? (
            <button onClick={handleCheckIn} disabled={loading} className="bg-green-600 text-white px-6 py-2 rounded">
              ✅ Check In
            </button>
          ) : !todayStatus?.checkedOut ? (
            <button onClick={handleCheckOut} disabled={loading} className="bg-red-600 text-white px-6 py-2 rounded">
              ❌ Check Out
            </button>
          ) : (
            <p className="text-green-600 font-semibold">✓ Completed for Today</p>
          )}
        </div>
        {todayStatus?.checkInTime && (
          <p className="mt-2">
            Check In: {todayStatus.checkInTime}
            {todayStatus?.lateMinutes > 0 && (
              <span className="text-red-500 ml-2">({todayStatus.lateMinutes} min late)</span>
            )}
          </p>
        )}
        {todayStatus?.checkOutTime && <p>Check Out: {todayStatus.checkOutTime}</p>}
      </div>

      {/* Attendance History Card */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">Attendance History</h2>
        {history.length === 0 ? (
          <p>No records found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 text-left">Date</th>
                  <th className="p-2 text-left">Check In</th>
                  <th className="p-2 text-left">Check Out</th>
                  <th className="p-2 text-left">Hours</th>
                </tr>
              </thead>
              <tbody>
                {history.map((r) => (
                  <tr key={r.id} className="border-b">
                    <td className="p-2">{new Date(r.date).toLocaleDateString()}</td>
                    <td className="p-2">{r.checkIn || "-"}</td>
                    <td className="p-2">{r.checkOut || "-"}</td>
                    <td className="p-2">{r.workingHours || 0} hrs</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// Holiday Calendar Component
function HolidayCalendar() {
  const [holidays, setHolidays] = useState([]);
  useEffect(() => { fetchHolidays(); }, []);
  const fetchHolidays = async () => { try { const res = await API.get("/holiday"); setHolidays(res.data); } catch (error) {} };
  return (<div className="bg-white p-6 rounded-lg shadow"><h2 className="text-xl font-bold mb-4">Holiday Calendar {new Date().getFullYear()}</h2>{holidays.length === 0 ? <p>No holidays added.</p> : (<div className="grid grid-cols-2 md:grid-cols-3 gap-4">{holidays.map(h => (<div key={h.id} className="border p-3 rounded"><p className="font-bold">{h.name}</p><p className="text-sm text-gray-600">{new Date(h.date).toLocaleDateString()}</p></div>))}</div>)}</div>);
}

// Salary View Component
function SalaryView() {
  const [salary, setSalary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => { fetchSalary(); }, [selectedMonth, selectedYear]);
  const fetchSalary = async () => { setLoading(true); try { const res = await API.get(`/salary/my-salary?month=${selectedMonth}&year=${selectedYear}`); setSalary(res.data); } catch (error) { toast.error("Failed to load salary"); } setLoading(false); };

  if (loading) return <div className="bg-white p-6 rounded-lg shadow text-center">Loading salary details...</div>;
  return (<div className="bg-white p-6 rounded-lg shadow"><h2 className="text-xl font-bold mb-4">💰 Salary Details - {new Date(selectedYear, selectedMonth-1).toLocaleString('default', { month: 'long' })} {selectedYear}</h2>
    <div className="flex gap-4 mb-6"><select className="p-2 border rounded" value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))}>{['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m,i)=> <option key={i} value={i+1}>{m}</option>)}</select>
    <select className="p-2 border rounded" value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))}>{[2024,2025,2026].map(y=> <option key={y} value={y}>{y}</option>)}</select></div>
    <div className="grid grid-cols-2 gap-4"><div className="bg-blue-50 p-3 rounded"><p className="text-sm">Present Days</p><p className="text-2xl font-bold">{salary?.presentDays || 0}/{salary?.totalWorkingDays || 22}</p></div>
    <div className="bg-red-50 p-3 rounded"><p className="text-sm">Absent Days</p><p className="text-2xl font-bold">{salary?.absentDays || 0}</p></div>
    <div className="bg-green-50 p-3 rounded"><p className="text-sm">Basic Salary</p><p className="text-xl font-bold">₹{salary?.basicSalary?.toLocaleString() || 0}</p></div>
    <div className="bg-green-50 p-3 rounded"><p className="text-sm">HRA</p><p className="text-xl font-bold">₹{salary?.hra?.toLocaleString() || 0}</p></div>
    <div className="bg-green-50 p-3 rounded"><p className="text-sm">DA</p><p className="text-xl font-bold">₹{salary?.da?.toLocaleString() || 0}</p></div>
    <div className="bg-orange-50 p-3 rounded"><p className="text-sm">PF Deduction</p><p className="text-xl font-bold">₹{salary?.pf?.toLocaleString() || 0}</p></div>
    <div className="bg-orange-50 p-3 rounded"><p className="text-sm">Tax Deduction</p><p className="text-xl font-bold">₹{salary?.tax?.toLocaleString() || 0}</p></div>
    <div className="bg-yellow-50 p-3 rounded"><p className="text-sm">Bonus</p><p className="text-xl font-bold">₹{salary?.bonus?.toLocaleString() || 0}</p></div>
    <div className="bg-purple-600 text-white p-4 rounded col-span-2"><p className="text-sm">Net Salary</p><p className="text-3xl font-bold">₹{salary?.netSalary?.toLocaleString() || 0}</p></div></div></div>);
}

// Profile Component
function Profile({ user, onProfileUpdate }) {
  const [form, setForm] = useState({ name: user?.name || '', email: user?.email || '', department: user?.department || '' });
  const [bankForm, setBankForm] = useState({ bankName: '', accountNumber: '', ifscCode: '', panNumber: '', upiId: '' });
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingBank, setIsEditingBank] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profileData, setProfileData] = useState(null);

  useEffect(() => { fetchProfile(); }, []);
  const fetchProfile = async () => { try { const res = await API.get("/auth/profile"); setProfileData(res.data); setBankForm({ bankName: res.data.bankName || '', accountNumber: res.data.accountNumber || '', ifscCode: res.data.ifscCode || '', panNumber: res.data.panNumber || '', upiId: res.data.upiId || '' }); } catch (error) {} };

  const handleSubmit = async (e) => { e.preventDefault(); setLoading(true); try { await API.put("/auth/update-profile", form); toast.success("Profile updated!"); setIsEditing(false); const updatedUser = { ...user, ...form }; localStorage.setItem("user", JSON.stringify(updatedUser)); onProfileUpdate(updatedUser); fetchProfile(); } catch (error) { toast.error("Failed"); } setLoading(false); };
  const handleBankSubmit = async (e) => { e.preventDefault(); try { await API.put("/auth/update-bank-details", bankForm); toast.success("Bank details saved!"); setIsEditingBank(false); fetchProfile(); } catch (error) { toast.error("Failed"); } };

  return (<div className="bg-white p-6 rounded-lg shadow"><div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold">👤 My Profile</h2>{!isEditing && <button onClick={() => setIsEditing(true)} className="bg-blue-600 text-white px-4 py-2 rounded">✏️ Edit Profile</button>}</div>
    {isEditing ? (<form onSubmit={handleSubmit} className="space-y-4"><div><label>Employee ID</label><input className="w-full p-2 border rounded bg-gray-100" value={profileData?.employeeId || ''} disabled /></div>
      <div><label>Full Name</label><input className="w-full p-2 border rounded" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
      <div><label>Email</label><input className="w-full p-2 border rounded" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
      <div><label>Department</label><input className="w-full p-2 border rounded" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} required /></div>
      <div className="flex gap-3"><button type="submit" disabled={loading} className="bg-green-600 text-white px-4 py-2 rounded">{loading ? "Saving..." : "Save"}</button><button type="button" onClick={() => setIsEditing(false)} className="bg-gray-400 text-white px-4 py-2 rounded">Cancel</button></div></form>) : (
      <div className="space-y-3"><div className="border-b pb-2"><p className="text-sm text-gray-500">Employee ID</p><p className="font-semibold">{profileData?.employeeId || 'N/A'}</p></div>
      <div className="border-b pb-2"><p className="text-sm text-gray-500">Full Name</p><p className="font-semibold">{profileData?.name}</p></div>
      <div className="border-b pb-2"><p className="text-sm text-gray-500">Email</p><p className="font-semibold">{profileData?.email}</p></div>
      <div className="border-b pb-2"><p className="text-sm text-gray-500">Department</p><p className="font-semibold">{profileData?.department || 'Not assigned'}</p></div>
      <div className="border-b pb-2"><p className="text-sm text-gray-500">Role</p><p className="font-semibold capitalize">{profileData?.role}</p></div></div>)}

    <div className="mt-6 border-t pt-4"><div className="flex justify-between items-center mb-4"><h3 className="font-bold text-blue-600">🏦 Bank Details</h3>{!isEditingBank && <button onClick={() => setIsEditingBank(true)} className="bg-blue-600 text-white px-3 py-1 rounded text-sm">Add/Edit Bank</button>}</div>
      {isEditingBank ? (<form onSubmit={handleBankSubmit} className="space-y-3"><input type="text" placeholder="Bank Name" className="w-full p-2 border rounded" value={bankForm.bankName} onChange={(e) => setBankForm({ ...bankForm, bankName: e.target.value })} required />
        <input type="text" placeholder="Account Number" className="w-full p-2 border rounded" value={bankForm.accountNumber} onChange={(e) => setBankForm({ ...bankForm, accountNumber: e.target.value })} required />
        <input type="text" placeholder="IFSC Code" className="w-full p-2 border rounded" value={bankForm.ifscCode} onChange={(e) => setBankForm({ ...bankForm, ifscCode: e.target.value })} required />
        <input type="text" placeholder="PAN Number" className="w-full p-2 border rounded" value={bankForm.panNumber} onChange={(e) => setBankForm({ ...bankForm, panNumber: e.target.value })} />
        <input type="text" placeholder="UPI ID (Optional)" className="w-full p-2 border rounded" value={bankForm.upiId} onChange={(e) => setBankForm({ ...bankForm, upiId: e.target.value })} />
        <div className="flex gap-2"><button type="submit" className="bg-green-600 text-white px-3 py-1 rounded">Save</button><button type="button" onClick={() => setIsEditingBank(false)} className="bg-gray-400 text-white px-3 py-1 rounded">Cancel</button></div></form>) : (
        <div className="space-y-2"><div className="flex justify-between"><span className="text-sm text-gray-500">Bank Name:</span><span>{bankForm.bankName || 'Not added'}</span></div>
        <div className="flex justify-between"><span className="text-sm text-gray-500">Account Number:</span><span>{bankForm.accountNumber ? '****' + bankForm.accountNumber.slice(-4) : 'Not added'}</span></div>
        <div className="flex justify-between"><span className="text-sm text-gray-500">IFSC Code:</span><span>{bankForm.ifscCode || 'Not added'}</span></div>
        <div className="flex justify-between"><span className="text-sm text-gray-500">PAN Number:</span><span>{bankForm.panNumber ? '****' + bankForm.panNumber.slice(-4) : 'Not added'}</span></div></div>)}
    </div>
  </div>);
}

// Admin Components (PendingLeaves, EmployeeList, ManageHolidays, Reports, AdminSalaryManagement, AdminAllUsers)
// [Due to length, these remain the same - they work perfectly]

function PendingLeaves() {
  const [leaves, setLeaves] = useState([]);
  useEffect(() => { fetchLeaves(); }, []);
  const fetchLeaves = async () => { try { const res = await API.get("/admin/pending-leaves"); setLeaves(res.data); } catch (error) { toast.error("Failed"); } };
  const handleAction = async (id, action) => { try { await API.put(`/admin/${action}-leave/${id}`); toast.success(`Leave ${action}ed`); fetchLeaves(); } catch (error) { toast.error("Failed"); } };
  if (leaves.length === 0) return <div className="bg-white p-6 rounded-lg shadow"><h2 className="text-xl font-bold mb-4">Pending Leaves</h2><p>No pending requests.</p></div>;
  return (<div className="bg-white p-6 rounded-lg shadow"><h2 className="text-xl font-bold mb-4">Pending Leave Requests</h2>{leaves.map(leave => (<div key={leave.id} className="border p-4 rounded mb-3"><p><strong>{leave.name}</strong> ({leave.employeeId}) - {leave.department}</p><p className="capitalize">{leave.leaveType} | {new Date(leave.fromDate).toLocaleDateString()} to {new Date(leave.toDate).toLocaleDateString()} | {leave.totalDays} days</p><p>Reason: {leave.reason}</p><div className="mt-2 space-x-2"><button onClick={() => handleAction(leave.id, "approve")} className="bg-green-600 text-white px-3 py-1 rounded">Approve</button><button onClick={() => handleAction(leave.id, "reject")} className="bg-red-600 text-white px-3 py-1 rounded">Reject</button></div></div>))}</div>);
}

function EmployeeList() {
  const [employees, setEmployees] = useState([]);
  useEffect(() => { fetchEmployees(); }, []);
  const fetchEmployees = async () => { try { const res = await API.get("/admin/employees"); setEmployees(res.data); } catch (error) { toast.error("Failed"); } };
  return (<div className="bg-white p-6 rounded-lg shadow"><h2 className="text-xl font-bold mb-4">Employee List</h2><div className="overflow-x-auto"><table className="w-full"><thead className="bg-gray-100"><tr><th className="p-2">ID</th><th>Name</th><th>Email</th><th>Department</th></tr></thead><tbody>{employees.map(emp => (<tr key={emp.id} className="border-b"><td className="p-2">{emp.employeeId}</td><td className="p-2">{emp.name}</td><td className="p-2">{emp.email}</td><td className="p-2">{emp.department}</td></tr>))}</tbody></table></div></div>);
}

function ManageHolidays() {
  const [holidays, setHolidays] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", date: "", type: "public" });
  useEffect(() => { fetchHolidays(); }, []);
  const fetchHolidays = async () => { try { const res = await API.get("/holiday"); setHolidays(res.data); } catch (error) {} };
  const handleSubmit = async (e) => { e.preventDefault(); try { await API.post("/holiday", form); toast.success("Holiday added"); setShowForm(false); setForm({ name: "", date: "", type: "public" }); fetchHolidays(); } catch (error) { toast.error("Failed"); } };
  const handleDelete = async (id) => { if (window.confirm("Delete?")) { try { await API.delete(`/holiday/${id}`); toast.success("Deleted"); fetchHolidays(); } catch (error) { toast.error("Failed"); } } };
  return (<div className="bg-white p-6 rounded-lg shadow"><div className="flex justify-between mb-4"><h2 className="text-xl font-bold">Manage Holidays</h2><button onClick={() => setShowForm(!showForm)} className="bg-blue-600 text-white px-3 py-1 rounded">+ Add</button></div>{showForm && (<form onSubmit={handleSubmit} className="mb-4 p-4 bg-gray-50 rounded"><input type="text" placeholder="Name" className="p-2 border rounded mr-2" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /><input type="date" className="p-2 border rounded mr-2" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /><button type="submit" className="bg-green-600 text-white px-3 py-2 rounded">Save</button></form>)}<div className="space-y-2">{holidays.map(h => (<div key={h.id} className="flex justify-between items-center border p-2 rounded"><span>{h.name} - {new Date(h.date).toLocaleDateString()}</span><button onClick={() => handleDelete(h.id)} className="bg-red-500 text-white px-2 py-1 rounded text-sm">Delete</button></div>))}</div></div>);
}

function Reports() {
  const downloadLeaves = () => { window.open('http://localhost:5000/api/admin/export-leaves', '_blank'); toast.success("Downloading..."); };
  const downloadAttendance = () => { window.open('http://localhost:5000/api/admin/export-attendance', '_blank'); toast.success("Downloading..."); };
  return (<div className="bg-white p-6 rounded-lg shadow"><h2 className="text-xl font-bold mb-4">📊 Reports</h2><div className="grid grid-cols-2 gap-4"><button onClick={downloadLeaves} className="bg-blue-600 text-white p-4 rounded-lg">📋 Leaves Report</button><button onClick={downloadAttendance} className="bg-green-600 text-white p-4 rounded-lg">⏰ Attendance Report</button></div></div>);
}

function AdminSalaryManagement() {
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [action, setAction] = useState("credit");
  useEffect(() => { fetchEmployees(); }, []);
  const fetchEmployees = async () => { try { const res = await API.get("/admin/employees"); setEmployees(res.data); } catch (error) { toast.error("Failed"); } };
  const handleAction = async () => { if (!selectedEmployee) { toast.error("Select employee"); return; } if (action !== "hold" && !amount) { toast.error("Enter amount"); return; } if (!reason) { toast.error("Enter reason"); return; } try { await API.post(`/admin/salary/${action}`, { employeeId: selectedEmployee, amount: parseFloat(amount), reason }); toast.success(`Salary ${action}ed`); setAmount(""); setReason(""); setSelectedEmployee(""); } catch (error) { toast.error("Failed"); } };
  return (<div className="bg-white p-6 rounded-lg shadow"><h2 className="text-xl font-bold mb-4">💰 Salary Management</h2><div className="space-y-4"><div><label className="block text-sm font-medium mb-1">Select Employee</label><select className="w-full p-2 border rounded" value={selectedEmployee} onChange={(e) => setSelectedEmployee(e.target.value)}><option value="">Select...</option>{employees.map(emp => (<option key={emp.id} value={emp.id}>{emp.name} ({emp.employeeId})</option>))}</select></div><div><label className="block text-sm font-medium mb-1">Action</label><div className="flex gap-3"><button onClick={() => setAction("credit")} className={`flex-1 p-2 rounded ${action === "credit" ? "bg-green-600 text-white" : "bg-gray-200"}`}>Credit</button><button onClick={() => setAction("hold")} className={`flex-1 p-2 rounded ${action === "hold" ? "bg-yellow-600 text-white" : "bg-gray-200"}`}>Hold</button><button onClick={() => setAction("debit")} className={`flex-1 p-2 rounded ${action === "debit" ? "bg-red-600 text-white" : "bg-gray-200"}`}>Debit</button></div></div>{action !== "hold" && (<div><label className="block text-sm font-medium mb-1">Amount (₹)</label><input type="number" className="w-full p-2 border rounded" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>)}<div><label className="block text-sm font-medium mb-1">Reason</label><textarea className="w-full p-2 border rounded" rows="2" value={reason} onChange={(e) => setReason(e.target.value)} required /></div><button onClick={handleAction} className="w-full bg-blue-600 text-white p-2 rounded">Process Salary</button></div></div>);
}

function AdminAllUsers() {
  const [users, setUsers] = useState([]);
  useEffect(() => { fetchUsers(); }, []);
  const fetchUsers = async () => { try { const res = await API.get("/admin/all-users"); setUsers(res.data); } catch (error) { toast.error("Failed"); } };
  return (<div className="bg-white p-6 rounded-lg shadow"><h2 className="text-xl font-bold mb-4">👥 All Users</h2><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-100"><tr><th>ID</th><th>Name</th><th>Email</th><th>Department</th><th>Bank</th><th>Account</th><th>IFSC</th><th>PAN</th></tr></thead><tbody>{users.map(u => (<tr key={u.id} className="border-b"><td className="p-2">{u.employeeId}</td><td className="p-2">{u.name}</td><td className="p-2">{u.email}</td><td className="p-2">{u.department}</td><td className="p-2">{u.bankName || '-'}</td><td className="p-2">{u.accountNumber ? '****' + u.accountNumber.slice(-4) : '-'}</td><td className="p-2">{u.ifscCode || '-'}</td><td className="p-2">{u.panNumber ? '****' + u.panNumber.slice(-4) : '-'}</td></tr>))}</tbody></table></div></div>);
}

// Dashboard Component
function Dashboard({ user, setUser }) {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [stats, setStats] = useState({ totalEmployees: 0, totalLeaves: 0, pendingLeaves: 0 });
  const isAdmin = user?.role === "admin";

  useEffect(() => { if (!isAdmin) fetchLeaveBalance(); fetchStats(); }, []);
  const fetchLeaveBalance = async () => { try { const res = await API.get("/leave/balance"); setLeaveBalance(res.data); } catch (error) {} };
  const fetchStats = async () => { try { const [empRes, leavesRes] = await Promise.all([API.get("/admin/employees"), API.get("/admin/all-leaves")]); const leaves = leavesRes.data || []; setStats({ totalEmployees: empRes.data?.length || 0, totalLeaves: leaves.length, pendingLeaves: leaves.filter(l => l.status === "pending").length }); } catch (error) {} };
  const handleLogout = () => { localStorage.clear(); setUser(null); toast.success("Logged out"); speak("You have been logged out."); };
  const chartData = { labels: ["Sick", "Casual", "Paid", "Emergency"], datasets: [{ label: "Available Days", data: leaveBalance ? [leaveBalance.sick_leave, leaveBalance.casual_leave, leaveBalance.paid_leave, leaveBalance.emergency_leave] : [0, 0, 0, 0], backgroundColor: ["#3b82f6", "#10b981", "#f59e0b", "#ef4444"] }] };

  const menuItems = isAdmin ? [
    { id: "dashboard", label: "📊 Dashboard" }, { id: "pending", label: "⏳ Pending Leaves" }, { id: "employees", label: "👥 Employees" },
    { id: "manageHolidays", label: "📅 Manage Holidays" }, { id: "reports", label: "📊 Reports" }, { id: "salaryManage", label: "💰 Salary Mgmt" },
    { id: "allUsers", label: "👥 All Users" }, { id: "profile", label: "👤 Profile" }
  ] : [
    { id: "dashboard", label: "📊 Dashboard" }, { id: "apply", label: "📝 Apply Leave" }, { id: "myLeaves", label: "📋 My Leaves" },
    { id: "attendance", label: "⏰ Attendance" }, { id: "holidays", label: "🎉 Holidays" }, { id: "salary", label: "💰 Salary" }, { id: "profile", label: "👤 Profile" }
  ];

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="w-64 bg-gradient-to-b from-gray-800 to-gray-900 text-white p-4 shadow-xl">
        <h2 className="text-xl font-bold mb-6">🏢 Good Friends</h2>
        {menuItems.map(item => (<button key={item.id} onClick={() => setActiveTab(item.id)} className={`w-full text-left p-2 mb-2 rounded transition ${activeTab === item.id ? "bg-blue-600" : "hover:bg-gray-700"}`}>{item.label}</button>))}
        <button onClick={handleLogout} className="w-full text-left p-2 mt-4 bg-red-600 rounded hover:bg-red-700">🚪 Logout</button>
      </div>
      <div className="flex-1 p-6 overflow-auto">
        <div className="flex justify-between items-center mb-6"><h1 className="text-2xl font-bold text-gray-800">Welcome, {user?.name}!</h1><div><p className="text-sm text-gray-600">{isAdmin ? "👑 Admin" : "👤 Employee"}</p><p className="text-sm">{user?.email}</p></div></div>
        
        {activeTab === "dashboard" && !isAdmin && leaveBalance && (<><div className="grid grid-cols-4 gap-4 mb-6"><div className="bg-blue-100 p-4 rounded text-center"><h3>Sick</h3><p className="text-2xl font-bold">{leaveBalance.sick_leave || 0}</p></div><div className="bg-green-100 p-4 rounded"><h3>Casual</h3><p className="text-2xl font-bold">{leaveBalance.casual_leave || 0}</p></div><div className="bg-yellow-100 p-4 rounded"><h3>Paid</h3><p className="text-2xl font-bold">{leaveBalance.paid_leave || 0}</p></div><div className="bg-red-100 p-4 rounded"><h3>Emergency</h3><p className="text-2xl font-bold">{leaveBalance.emergency_leave || 0}</p></div></div><div className="bg-white p-6 rounded-lg shadow"><Bar data={chartData} /></div></>)}
        
        {activeTab === "dashboard" && isAdmin && (<><div className="grid grid-cols-3 gap-4 mb-6"><div className="bg-blue-100 p-4 rounded text-center"><h3>Total Employees</h3><p className="text-3xl font-bold">{stats.totalEmployees}</p></div><div className="bg-green-100 p-4 rounded"><h3>Total Leaves</h3><p className="text-3xl font-bold">{stats.totalLeaves}</p></div><div className="bg-yellow-100 p-4 rounded"><h3>Pending</h3><p className="text-3xl font-bold">{stats.pendingLeaves}</p></div></div><div className="bg-white p-6 rounded-lg shadow"><Bar data={{ labels: ["Total Leaves", "Pending"], datasets: [{ label: "Count", data: [stats.totalLeaves, stats.pendingLeaves], backgroundColor: ["#3b82f6", "#f59e0b"] }] }} /></div></>)}
        
        {activeTab === "apply" && <ApplyLeave onLeaveApplied={() => setActiveTab("myLeaves")} />}
        {activeTab === "myLeaves" && <MyLeaves />}
        {activeTab === "attendance" && <Attendance />}
        {activeTab === "holidays" && <HolidayCalendar />}
        {activeTab === "salary" && <SalaryView />}
        {activeTab === "pending" && <PendingLeaves />}
        {activeTab === "employees" && <EmployeeList />}
        {activeTab === "manageHolidays" && <ManageHolidays />}
        {activeTab === "reports" && <Reports />}
        {activeTab === "salaryManage" && isAdmin && <AdminSalaryManagement />}
        {activeTab === "allUsers" && isAdmin && <AdminAllUsers />}
        {activeTab === "profile" && <Profile user={user} onProfileUpdate={setUser} />}
      </div>
    </div>
  );
}

// Main App
function App() {
  const [user, setUser] = useState(null);
  const [showFaceLogin, setShowFaceLogin] = useState(false);
  const [showFaceRegister, setShowFaceRegister] = useState(false);

  useEffect(() => { const storedUser = localStorage.getItem("user"); if (storedUser) setUser(JSON.parse(storedUser)); }, []);

  if (user) return (<><Toaster position="top-right" /><Dashboard user={user} setUser={setUser} /></>);
  if (showFaceRegister) return (<><Toaster position="top-right" /><div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center"><FaceRegister onRegister={setUser} onBack={() => setShowFaceRegister(false)} /></div></>);

  return (<><Toaster position="top-right" /><div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
    {showFaceLogin ? <FaceLogin onLogin={setUser} onBack={() => setShowFaceLogin(false)} /> :
    <Login onLogin={setUser} onShowFaceLogin={() => setShowFaceLogin(true)} onShowRegister={() => setShowFaceRegister(true)} />}
  </div></>);
}

export default App;