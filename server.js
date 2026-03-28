const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const db = require('./database');
const fs = require('fs');
const driveService = require('./googleDriveService');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: true,
    credentials: true
}));

// Root / Health Check (Important for Render stability)
app.get('/', (req, res) => {
    res.status(200).send('Certificate System Backend is Running');
});

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
    const redirectUrl = process.env.REDIRECT_URL || '';
    if (username === 'admin' && password === 'admin123') {
        // Set cookie with SameSite=None and Secure for cross-domain support
        res.setHeader('Set-Cookie', 'adminAuth=true; Path=/; HttpOnly; SameSite=None; Secure');
        res.redirect(`${redirectUrl}/admin.html`);
    } else {
        res.redirect(`${redirectUrl}/login.html?error=1`);
    }
});

// Logout Route
app.get('/logout', (req, res) => {
    const redirectUrl = process.env.REDIRECT_URL || '';
    res.setHeader('Set-Cookie', 'adminAuth=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=None; Secure');
    res.redirect(`${redirectUrl}/index.html`);
});

// Protected Admin UI Route
app.get('/admin', adminAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'admin.html'));
});

// Admin Route: Upload a certificate
app.post('/admin/upload', adminAuth, upload.single('certificate'), async (req, res) => {
    const { cert_number, student_name, course } = req.body;

    if (!req.file || !cert_number) {
        return res.status(400).json({ error: 'Certificate file and number are required.' });
    }

    try {
        // [DUPLICATE CHECK] Check if a file with the same name already exists on Google Drive
        const existingFile = await driveService.findFileByName(req.file.originalname);
        if (existingFile) {
            return res.status(400).json({ error: 'PDF already exists' });
        }

        // [UPLOAD] Upload the file using its original name
        const driveFile = await driveService.uploadFile(
            req.file.buffer,
            req.file.originalname,
            req.file.mimetype
        );

        db.run(
            `INSERT INTO certificates (cert_number, student_name, course, file_path, google_drive_id) VALUES (?, ?, ?, ?, ?)`,
            [cert_number, student_name, course || null, 'GOOGLE_DRIVE', driveFile.id],
            function (err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(400).json({ error: 'Certificate number already exists.' });
                    }
                    return res.status(500).json({ error: err.message });
                }
                res.json({
                    message: 'uploaded successful',
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
app.get('/api/search/:certNumber', async (req, res) => {
    const certNumber = req.params.certNumber;

    db.get(`SELECT * FROM certificates WHERE LOWER(cert_number) = LOWER(?) OR LOWER(course) = LOWER(?)`, [certNumber, certNumber], async (err, row) => {
        if (err) {
            console.error('DB Error:', err.message);
        }

        if (row) {
            // Found in DB (by cert number or course)
            return res.json({
                id: row.id,
                cert_number: row.cert_number,
                student_name: row.student_name,
                course: row.course,
                download_url: `https://drive.google.com/uc?export=download&id=${row.google_drive_id}`
            });
        }

        // FALLBACK: If not in DB (lost on Render), search Google Drive directly by Filename
        try {
            const driveFile = await driveService.findFileByName(certNumber);
            if (driveFile) {
                return res.json({
                    id: 0,
                    cert_number: certNumber,
                    student_name: 'Verified Student',
                    download_url: `https://drive.google.com/uc?export=download&id=${driveFile.id}`
                });
            }
        } catch (driveErr) {
            console.error('Drive Search Error:', driveErr);
        }

        res.status(404).json({ error: 'Certificate not found. Please check your number.' });
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
