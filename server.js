const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const driveService = require('./googleDriveService');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // In production, you might want to restrict this to your Hostinger domain
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Setup multer for PDF uploads
const dataDir = process.env.DATA_DIR || __dirname;
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDFs are allowed.'));
        }
    }
});

// Custom Cookie Middleware
const adminAuth = (req, res, next) => {
    const cookies = req.headers.cookie;
    if (cookies && cookies.includes('adminAuth=true')) {
        next();
    } else {
        res.redirect('/login');
    }
};

// Login Routes
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'admin' && password === 'admin123') {
        res.setHeader('Set-Cookie', 'adminAuth=true; Path=/; HttpOnly');
        res.redirect('/admin');
    } else {
        res.redirect('/login?error=1');
    }
});

// Logout Route
app.get('/logout', (req, res) => {
    res.setHeader('Set-Cookie', 'adminAuth=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
    res.redirect('/admin');
});

// Protected Admin UI Route
app.get('/admin', adminAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'admin.html'));
});

// Admin Route: Upload a certificate
app.post('/admin/upload', adminAuth, upload.single('certificate'), async (req, res) => {
    const { cert_number, student_name } = req.body;
    
    if (!req.file || !cert_number) {
        return res.status(400).json({ error: 'Certificate file and number are required.' });
    }

    try {
        const driveFile = await driveService.uploadFile(
            req.file.buffer, 
            `${cert_number}-${req.file.originalname}`, 
            req.file.mimetype
        );

        db.run(
            `INSERT INTO certificates (cert_number, student_name, google_drive_id) VALUES (?, ?, ?)`,
            [cert_number, student_name, driveFile.id],
            function(err) {
                if (err) {
                    if(err.message.includes('UNIQUE constraint failed')) {
                         return res.status(400).json({ error: 'Certificate number already exists.'});
                    }
                    return res.status(500).json({ error: err.message });
                }
                res.json({ 
                    message: 'Certificate uploaded successfully!', 
                    id: this.lastID,
                    drive_id: driveFile.id 
                });
            }
        );
    } catch (error) {
        console.error('Upload Error:', error);
        res.status(500).json({ error: 'Failed to upload to Google Drive: ' + error.message });
    }
});

// Public Route: Search for a certificate
app.get('/api/search/:certNumber', (req, res) => {
    const certNumber = req.params.certNumber;

    db.get(`SELECT * FROM certificates WHERE cert_number = ?`, [certNumber], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!row) {
            return res.status(404).json({ error: 'Certificate not found. Please check your number.' });
        }
        res.json({
            id: row.id,
            cert_number: row.cert_number,
            student_name: row.student_name,
            download_url: `https://drive.google.com/uc?export=download&id=${row.google_drive_id}`
        });
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
