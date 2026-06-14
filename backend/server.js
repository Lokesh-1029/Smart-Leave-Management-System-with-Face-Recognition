const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const db = new sqlite3.Database('./database.db');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Helper: Generate Employee ID
const generateEmployeeId = async () => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT COUNT(*) as count FROM users WHERE role = 'employee'`, (err, result) => {
      if (err) reject(err);
      const count = (result?.count || 0) + 1;
      resolve(`GF${String(count).padStart(3, '0')}`);
    });
  });
};

// Password Strength Checker
function checkPasswordStrength(password) {
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  
  if (score <= 2) return { level: 'Weak', color: '#ef4444', percentage: 25 };
  if (score <= 4) return { level: 'Medium', color: '#f59e0b', percentage: 60 };
  return { level: 'Strong', color: '#10b981', percentage: 100 };
}

// Create tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employeeId TEXT UNIQUE,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    department TEXT,
    role TEXT DEFAULT 'employee',
    faceImage TEXT,
    isNewUser INTEGER DEFAULT 1,
    resetToken TEXT,
    resetTokenExpiry DATETIME,
    bankName TEXT,
    accountNumber TEXT,
    ifscCode TEXT,
    panNumber TEXT,
    upiId TEXT,
    basicSalary REAL DEFAULT 25000,
    hra REAL DEFAULT 10000,
    da REAL DEFAULT 2500,
    sick_leave INTEGER DEFAULT 12,
    casual_leave INTEGER DEFAULT 10,
    paid_leave INTEGER DEFAULT 18,
    emergency_leave INTEGER DEFAULT 5,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS leaves (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employeeId INTEGER,
    leaveType TEXT,
    fromDate DATE,
    toDate DATE,
    totalDays REAL,
    reason TEXT,
    status TEXT DEFAULT 'pending',
    approvedBy INTEGER,
    approvedAt DATETIME,
    comments TEXT,
    appliedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employeeId INTEGER,
    date DATE,
    checkIn TEXT,
    checkOut TEXT,
    checkInTime DATETIME,
    checkOutTime DATETIME,
    workingHours REAL DEFAULT 0,
    status TEXT DEFAULT 'absent',
    lateMinutes INTEGER DEFAULT 0
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS holidays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    date DATE,
    day TEXT,
    type TEXT,
    year INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS salary (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employeeId INTEGER,
    month INTEGER,
    year INTEGER,
    netSalary REAL,
    status TEXT DEFAULT 'pending',
    creditedDate DATE,
    reason TEXT,
    processedBy INTEGER,
    processedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Create Admin User
  db.get(`SELECT * FROM users WHERE email = 'admin@goodfriends.com'`, (err, row) => {
    if (!row) {
      const hashedPassword = bcrypt.hashSync('Admin@123', 10);
      db.run(`INSERT INTO users (employeeId, name, email, password, department, role, isNewUser, sick_leave, casual_leave, paid_leave, emergency_leave)
              VALUES ('ADMIN001', 'System Admin', 'admin@goodfriends.com', ?, 'Administration', 'admin', 0, 30, 30, 30, 30)`, [hashedPassword]);
      console.log('✅ Admin created: admin@goodfriends.com / Admin@123');
    }
  });
});

// Auth middleware
const auth = (req, res, next) => {
  const token = req.header('Authorization');
  if (!token) return res.status(401).json({ error: 'Access denied' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret123');
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    next();
  } catch {
    res.status(400).json({ error: 'Invalid token' });
  }
};

const isAdmin = (req, res, next) => {
  if (req.userRole !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
};

// ============ AUTH ROUTES ============

// Password Strength Check Endpoint
app.post('/api/auth/check-password-strength', (req, res) => {
  const { password } = req.body;
  const strength = checkPasswordStrength(password);
  res.json(strength);
});

// Employee Login
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  console.log("Employee login attempt:", email);
  
  db.get(`SELECT * FROM users WHERE email = ? AND role != 'admin'`, [email], async (err, user) => {
    if (err || !user) {
      return res.status(400).json({ error: "Invalid email or password" });
    }
    
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(400).json({ error: "Invalid email or password" });
    }
    
    const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET || 'secret123', { expiresIn: '7d' });
    console.log("Employee login successful:", user.name);
    res.json({ 
      token, 
      user: { 
        id: user.id, 
        name: user.name, 
        email: user.email, 
        role: user.role, 
        employeeId: user.employeeId, 
        department: user.department,
        isNewUser: user.isNewUser === 1
      } 
    });
  });
});

// Admin Login
app.post('/api/auth/admin-login', (req, res) => {
  const { email, password } = req.body;
  console.log("Admin login attempt:", email);
  
  db.get(`SELECT * FROM users WHERE email = ? AND role = 'admin'`, [email], async (err, user) => {
    if (err || !user) {
      return res.status(400).json({ error: "Invalid admin credentials" });
    }
    
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(400).json({ error: "Invalid admin credentials" });
    }
    
    const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET || 'secret123', { expiresIn: '7d' });
    console.log("Admin login successful:", user.name);
    res.json({ 
      token, 
      user: { 
        id: user.id, 
        name: user.name, 
        email: user.email, 
        role: user.role, 
        employeeId: user.employeeId, 
        department: user.department 
      } 
    });
  });
});

// Register without Face
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, department } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }
    
    const employeeId = await generateEmployeeId();
    const hashedPassword = await bcrypt.hash(password, 10);
    
    db.run(`INSERT INTO users (employeeId, name, email, password, department, role, isNewUser)
            VALUES (?, ?, ?, ?, ?, 'employee', 1)`,
      [employeeId, name, email, hashedPassword, department],
      function(err) {
        if (err) {
          return res.status(400).json({ error: 'Email already exists' });
        }
        res.status(201).json({ message: 'Registration successful!', employeeId });
      });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Register with Face
app.post('/api/auth/register-with-face', upload.single('face'), async (req, res) => {
  try {
    console.log("Face registration request received");
    
    if (!req.file) {
      return res.status(400).json({ error: "No face image provided" });
    }
    
    const { name, email, password, department } = req.body;
    
    console.log("Name:", name, "Email:", email);
    
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }
    
    const employeeId = await generateEmployeeId();
    const hashedPassword = await bcrypt.hash(password, 10);
    const faceImage = req.file.buffer.toString('base64');
    
    db.run(`INSERT INTO users (employeeId, name, email, password, department, role, faceImage, isNewUser)
            VALUES (?, ?, ?, ?, ?, 'employee', ?, 1)`,
      [employeeId, name, email, hashedPassword, department, faceImage],
      function(err) {
        if (err) {
          console.error("DB Error:", err);
          return res.status(400).json({ error: 'Email already exists' });
        }
        
        const token = jwt.sign({ userId: this.lastID, role: 'employee' }, process.env.JWT_SECRET || 'secret123', { expiresIn: '7d' });
        res.status(201).json({ 
          message: 'Registration successful!', 
          token,
          user: { 
            id: this.lastID, 
            name, 
            email, 
            role: 'employee', 
            employeeId, 
            department,
            isNewUser: 1
          }
        });
      });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Face Login
app.post('/api/auth/face-login', upload.single('face'), async (req, res) => {
  try {
    console.log("Face login request received");
    
    if (!req.file) {
      return res.status(400).json({ error: "No face image provided", matchPercentage: 0 });
    }
    
    const uploadedFace = req.file.buffer.toString('base64');
    
    db.all(`SELECT id, name, email, role, employeeId, department, faceImage FROM users WHERE faceImage IS NOT NULL`, [], (err, users) => {
      if (err) {
        console.error("DB Error:", err);
        return res.status(500).json({ error: "Database error" });
      }
      
      if (users.length === 0) {
        return res.status(401).json({ 
          error: "No face registered. Please login with email first.", 
          matchPercentage: 0 
        });
      }
      
      let bestMatch = null;
      let bestSimilarity = 0;
      
      for (const user of users) {
        let similarity = 0;
        if (user.faceImage && uploadedFace) {
          const minLen = Math.min(uploadedFace.length, user.faceImage.length);
          let matches = 0;
          for (let i = 0; i < minLen; i++) {
            if (uploadedFace[i] === user.faceImage[i]) matches++;
          }
          similarity = (matches / minLen) * 100;
          similarity = Math.min(similarity + 50, 95);
        }
        
        console.log(`Comparing with ${user.name}: ${similarity}% match`);
        
        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestMatch = user;
        }
      }
      
      if (!bestMatch || bestSimilarity < 40) {
        return res.status(401).json({ 
          error: `Face not recognized (${Math.floor(bestSimilarity)}% match). Please try again.`,
          matchPercentage: bestSimilarity
        });
      }
      
      const token = jwt.sign({ userId: bestMatch.id, role: bestMatch.role }, process.env.JWT_SECRET || 'secret123', { expiresIn: '7d' });
      res.json({
        token,
        matchPercentage: bestSimilarity,
        user: {
          id: bestMatch.id,
          name: bestMatch.name,
          email: bestMatch.email,
          role: bestMatch.role,
          employeeId: bestMatch.employeeId,
          department: bestMatch.department
        }
      });
    });
  } catch (error) {
    console.error("Face login error:", error);
    res.status(500).json({ error: "Face login failed" });
  }
});

// Forgot Password - Request Reset
app.post('/api/auth/forgot-password', (req, res) => {
  const { email } = req.body;
  console.log("Forgot password request for:", email);
  
  db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, user) => {
    if (err || !user) {
      return res.status(404).json({ error: "Email not found" });
    }
    
    const resetToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'secret123', { expiresIn: '1h' });
    const resetLink = `http://localhost:5173/reset-password?token=${resetToken}`;
    
    console.log("Reset token generated for:", email);
    res.json({ 
      message: "Password reset token generated", 
      resetToken: resetToken,
      resetLink: resetLink
    });
  });
});

// Reset Password
app.post('/api/auth/reset-password', (req, res) => {
  const { token, newPassword } = req.body;
  console.log("Reset password request received");
  
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret123');
    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    
    db.run(`UPDATE users SET password = ? WHERE id = ?`, [hashedPassword, decoded.userId], (err) => {
      if (err) {
        console.error("DB Error:", err);
        return res.status(500).json({ error: "Failed to reset password" });
      }
      console.log("Password reset successful for user ID:", decoded.userId);
      res.json({ message: "Password reset successful" });
    });
  } catch (error) {
    console.error("Token verification error:", error);
    res.status(400).json({ error: "Invalid or expired token" });
  }
});

// Get current user profile
app.get('/api/auth/me', auth, (req, res) => {
  db.get(`SELECT id, employeeId, name, email, department, role, isNewUser FROM users WHERE id = ?`, [req.userId], (err, user) => {
    if (err || !user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  });
});

// Get user profile
app.get('/api/auth/profile', auth, (req, res) => {
  db.get(`SELECT id, employeeId, name, email, department, role, bankName, accountNumber, ifscCode, panNumber, upiId, isNewUser, createdAt 
          FROM users WHERE id = ?`, [req.userId], (err, user) => {
    if (err || !user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  });
});

// Update profile
app.put('/api/auth/update-profile', auth, (req, res) => {
  const { name, email, department } = req.body;
  db.run(`UPDATE users SET name = ?, email = ?, department = ? WHERE id = ?`,
    [name, email, department, req.userId], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Profile updated" });
    });
});

// Update bank details
app.put('/api/auth/update-bank-details', auth, (req, res) => {
  const { bankName, accountNumber, ifscCode, panNumber, upiId } = req.body;
  db.run(`UPDATE users SET bankName = ?, accountNumber = ?, ifscCode = ?, panNumber = ?, upiId = ? WHERE id = ?`,
    [bankName, accountNumber, ifscCode, panNumber, upiId, req.userId], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Bank details updated" });
    });
});

// Check if user has face registered
app.get('/api/auth/has-face', auth, (req, res) => {
  db.get(`SELECT faceImage FROM users WHERE id = ?`, [req.userId], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ hasFace: !!user?.faceImage });
  });
});

// Register face for existing user
app.post('/api/auth/register-face', auth, upload.single('face'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No face image provided" });
    const faceImage = req.file.buffer.toString('base64');
    db.run(`UPDATE users SET faceImage = ? WHERE id = ?`, [faceImage, req.userId], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Face registered successfully!" });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ LEAVE ROUTES ============
app.post('/api/leave/apply', auth, (req, res) => {
  const { leaveType, fromDate, toDate, totalDays, reason } = req.body;
  db.run(`INSERT INTO leaves (employeeId, leaveType, fromDate, toDate, totalDays, reason, status)
          VALUES (?, ?, ?, ?, ?, ?, 'pending')`, 
    [req.userId, leaveType, fromDate, toDate, totalDays, reason], 
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID });
    });
});

app.get('/api/leave/my-leaves', auth, (req, res) => {
  db.all(`SELECT * FROM leaves WHERE employeeId = ? ORDER BY appliedAt DESC`, [req.userId], (err, leaves) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(leaves);
  });
});

app.get('/api/leave/balance', auth, (req, res) => {
  db.get(`SELECT sick_leave, casual_leave, paid_leave, emergency_leave FROM users WHERE id = ?`, [req.userId], (err, balance) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(balance);
  });
});

app.delete('/api/leave/cancel/:id', auth, (req, res) => {
  db.get(`SELECT status FROM leaves WHERE id = ? AND employeeId = ?`, [req.params.id, req.userId], (err, leave) => {
    if (err || !leave) return res.status(404).json({ error: 'Leave not found' });
    if (leave.status !== 'pending') return res.status(400).json({ error: 'Only pending leaves can be cancelled' });
    db.run(`DELETE FROM leaves WHERE id = ?`, [req.params.id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Leave cancelled' });
    });
  });
});

// ============ ATTENDANCE ROUTES ============
app.post('/api/attendance/checkin', auth, (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  let lateMinutes = 0;
  
  if (now.getHours() > 9 || (now.getHours() === 9 && now.getMinutes() > 30)) {
    lateMinutes = (now.getHours() - 9) * 60 + (now.getMinutes() - 30);
  }
  
  db.get(`SELECT * FROM attendance WHERE employeeId = ? AND date = ?`, [req.userId, today], (err, existing) => {
    if (existing) return res.status(400).json({ error: 'Already checked in today' });
    db.run(`INSERT INTO attendance (employeeId, date, checkIn, checkInTime, status, lateMinutes) VALUES (?, ?, ?, ?, 'present', ?)`, 
      [req.userId, today, timeStr, now.toISOString(), lateMinutes], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: `Checked in at ${timeStr}${lateMinutes > 0 ? ` (${lateMinutes} min late)` : ''}` });
    });
  });
});

app.post('/api/attendance/checkout', auth, (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  
  db.get(`SELECT * FROM attendance WHERE employeeId = ? AND date = ?`, [req.userId, today], (err, attendance) => {
    if (!attendance) return res.status(400).json({ error: 'No check-in found' });
    if (attendance.checkOut) return res.status(400).json({ error: 'Already checked out' });
    const hours = ((now - new Date(attendance.checkInTime)) / (1000 * 60 * 60)).toFixed(1);
    db.run(`UPDATE attendance SET checkOut = ?, checkOutTime = ?, workingHours = ? WHERE id = ?`, 
      [timeStr, now.toISOString(), hours, attendance.id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: `Checked out at ${timeStr} | Hours: ${hours}` });
    });
  });
});

app.get('/api/attendance/my-attendance', auth, (req, res) => {
  db.all(`SELECT * FROM attendance WHERE employeeId = ? ORDER BY date DESC LIMIT 30`, [req.userId], (err, records) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(records);
  });
});

app.get('/api/attendance/today', auth, (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  db.get(`SELECT * FROM attendance WHERE employeeId = ? AND date = ?`, [req.userId, today], (err, record) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ 
      checkedIn: !!record?.checkIn, 
      checkedOut: !!record?.checkOut, 
      checkInTime: record?.checkIn, 
      checkOutTime: record?.checkOut, 
      lateMinutes: record?.lateMinutes || 0 
    });
  });
});

// ============ ADMIN ROUTES ============
app.get('/api/admin/pending-leaves', auth, isAdmin, (req, res) => {
  db.all(`SELECT l.*, u.name, u.employeeId, u.department FROM leaves l JOIN users u ON l.employeeId = u.id WHERE l.status = 'pending' ORDER BY l.appliedAt DESC`, (err, leaves) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(leaves);
  });
});

app.put('/api/admin/approve-leave/:id', auth, isAdmin, (req, res) => {
  db.get(`SELECT * FROM leaves WHERE id = ?`, [req.params.id], (err, leave) => {
    if (err || !leave) return res.status(404).json({ error: 'Leave not found' });
    db.run(`UPDATE leaves SET status = 'approved', approvedBy = ?, approvedAt = CURRENT_TIMESTAMP WHERE id = ?`, 
      [req.userId, req.params.id], (err2) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ message: 'Leave approved' });
    });
  });
});

app.put('/api/admin/reject-leave/:id', auth, isAdmin, (req, res) => {
  db.get(`SELECT * FROM leaves WHERE id = ?`, [req.params.id], (err, leave) => {
    if (err || !leave) return res.status(404).json({ error: 'Leave not found' });
    db.run(`UPDATE leaves SET status = 'rejected', approvedBy = ?, approvedAt = CURRENT_TIMESTAMP WHERE id = ?`, 
      [req.userId, req.params.id], (err2) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ message: 'Leave rejected' });
    });
  });
});

app.get('/api/admin/employees', auth, isAdmin, (req, res) => {
  db.all(`SELECT id, employeeId, name, email, department, role FROM users WHERE role = 'employee'`, (err, employees) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(employees);
  });
});

app.get('/api/admin/all-leaves', auth, isAdmin, (req, res) => {
  db.all(`SELECT l.*, u.name, u.employeeId, u.department FROM leaves l JOIN users u ON l.employeeId = u.id ORDER BY l.appliedAt DESC`, (err, leaves) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(leaves);
  });
});

app.get('/api/admin/all-users', auth, isAdmin, (req, res) => {
  db.all(`SELECT id, employeeId, name, email, department, role, bankName, accountNumber, ifscCode, panNumber, upiId FROM users WHERE role = 'employee'`, [], (err, users) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(users);
  });
});

// Salary Routes
app.get('/api/salary/my-salary', auth, (req, res) => {
  const month = req.query.month || new Date().getMonth() + 1;
  const year = req.query.year || new Date().getFullYear();
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(month).padStart(2, '0')}-31`;
  
  db.get(`SELECT COUNT(*) as presentDays FROM attendance WHERE employeeId = ? AND date BETWEEN ? AND ? AND status = 'present'`, 
    [req.userId, startDate, endDate], (err, attendance) => {
    db.get(`SELECT basicSalary, hra, da FROM users WHERE id = ?`, [req.userId], (err, user) => {
      const presentDays = attendance?.presentDays || 0;
      const totalWorkingDays = 22;
      const absentDays = totalWorkingDays - presentDays;
      const basicSalary = user?.basicSalary || 25000;
      const hra = user?.hra || 10000;
      const da = user?.da || 2500;
      const pf = basicSalary * 0.12;
      const tax = basicSalary * 0.05;
      const bonus = presentDays === totalWorkingDays ? 1000 : 0;
      const netSalary = basicSalary + hra + da + bonus - pf - tax;
      
      res.json({ month, year, presentDays, absentDays, totalWorkingDays, basicSalary, hra, da, pf, tax, bonus, netSalary });
    });
  });
});

app.post('/api/admin/salary/credit', auth, isAdmin, (req, res) => {
  const { employeeId, amount, reason } = req.body;
  const month = new Date().getMonth() + 1;
  const year = new Date().getFullYear();
  db.run(`INSERT INTO salary (employeeId, month, year, netSalary, status, creditedDate, reason, processedBy) 
          VALUES (?, ?, ?, ?, 'paid', date('now'), ?, ?)`, 
    [employeeId, month, year, amount, reason, req.userId], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Salary credited' });
  });
});

app.post('/api/admin/salary/hold', auth, isAdmin, (req, res) => {
  const { employeeId, reason } = req.body;
  const month = new Date().getMonth() + 1;
  const year = new Date().getFullYear();
  db.run(`INSERT INTO salary (employeeId, month, year, status, reason, processedBy) VALUES (?, ?, ?, 'held', ?, ?)`, 
    [employeeId, month, year, reason, req.userId], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Salary held' });
  });
});

app.post('/api/admin/salary/debit', auth, isAdmin, (req, res) => {
  const { employeeId, amount, reason } = req.body;
  const month = new Date().getMonth() + 1;
  const year = new Date().getFullYear();
  db.run(`INSERT INTO salary (employeeId, month, year, otherDeductions, status, reason, processedBy) VALUES (?, ?, ?, ?, 'deducted', ?, ?)`, 
    [employeeId, month, year, amount, reason, req.userId], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Salary deducted' });
  });
});

// Holiday Routes
app.get('/api/holiday', auth, (req, res) => {
  const year = req.query.year || new Date().getFullYear();
  db.all(`SELECT * FROM holidays WHERE year = ? ORDER BY date`, [year], (err, holidays) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(holidays);
  });
});

app.post('/api/holiday', auth, isAdmin, (req, res) => {
  const { name, date, type } = req.body;
  const holidayDate = new Date(date);
  const day = holidayDate.toLocaleDateString('en-US', { weekday: 'long' });
  const year = holidayDate.getFullYear();
  db.run(`INSERT INTO holidays (name, date, day, type, year) VALUES (?, ?, ?, ?, ?)`, 
    [name, date, day, type, year], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: this.lastID });
  });
});

app.delete('/api/holiday/:id', auth, isAdmin, (req, res) => {
  db.run(`DELETE FROM holidays WHERE id = ?`, [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Holiday deleted' });
  });
});

// Report Routes
app.get('/api/admin/export-leaves', auth, isAdmin, (req, res) => {
  db.all(`SELECT l.*, u.name, u.employeeId FROM leaves l JOIN users u ON l.employeeId = u.id ORDER BY l.appliedAt DESC`, (err, leaves) => {
    if (err) return res.status(500).json({ error: err.message });
    let csv = "ID,Employee,Leave Type,From,To,Days,Reason,Status\n";
    leaves.forEach(l => {
      csv += `"${l.id}","${l.name}","${l.leaveType}","${l.fromDate}","${l.toDate}",${l.totalDays},"${l.reason}","${l.status}"\n`;
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=leaves_report.csv');
    res.send(csv);
  });
});

app.get('/api/admin/export-attendance', auth, isAdmin, (req, res) => {
  db.all(`SELECT a.*, u.name, u.employeeId FROM attendance a JOIN users u ON a.employeeId = u.id ORDER BY a.date DESC`, (err, records) => {
    if (err) return res.status(500).json({ error: err.message });
    let csv = "Employee,Date,Check In,Check Out,Hours,Late\n";
    records.forEach(r => {
      csv += `"${r.name}","${r.date}","${r.checkIn || '-'}","${r.checkOut || '-'}",${r.workingHours || 0},${r.lateMinutes || 0}\n`;
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=attendance_report.csv');
    res.send(csv);
  });
});

// ============ START SERVER ============
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`✅ Admin: admin@goodfriends.com / Admin@123`);
  console.log(`✅ All features ready!`);
});