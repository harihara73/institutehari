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
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
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
        const cleanCertNumber = cert_number.trim();
        
        // [CHECK 1] Case-insensitive check for certificate number in DB
        db.get(`SELECT id FROM certificates WHERE LOWER(cert_number) = LOWER(?)`, [cleanCertNumber], async (dbErr, row) => {
            if (dbErr) return res.status(500).json({ error: dbErr.message });
            if (row) {
                return res.status(400).json({ error: 'Certificate Number already exists in database.' });
            }

            // [CHECK 2] Check if PDF with same name exists on Google Drive
            const existingFile = await driveService.findFileByExactName(req.file.originalname);
            if (existingFile) {
                return res.status(400).json({ error: 'PDF filename already exists on Google Drive.' });
            }

            // [UPLOAD] Now that both checks passed, upload the file
            const driveFile = await driveService.uploadFile(
                req.file.buffer,
                req.file.originalname,
                req.file.mimetype
            );

            // [INSERT] Save to database
            db.run(
                `INSERT INTO certificates (cert_number, student_name, course, file_path, google_drive_id) VALUES (?, ?, ?, ?, ?)`,
                [cleanCertNumber, student_name, course || null, 'GOOGLE_DRIVE', driveFile.id],
                function (err) {
                    if (err) {
                        if (err.message.includes('UNIQUE constraint failed')) {
                            return res.status(400).json({ error: 'Certificate Number already exists in database.' });
                        }
                        return res.status(500).json({ error: 'Database Error: ' + err.message });
                    }
                    res.json({
                        message: 'uploaded successful',
                        id: this.lastID,
                        drive_id: driveFile.id
                    });
                }
            );
        });
    } catch (error) {
        console.error('Upload Process Error:', error);
        res.status(500).json({ error: 'Failed to complete upload process: ' + error.message });
    }
});

// Public Route: Search for a certificate
app.get('/api/search/:certNumber', async (req, res) => {
    const certNumber = req.params.certNumber;

    const searchPattern = `%${certNumber}%`;
    db.all(`SELECT * FROM certificates WHERE LOWER(cert_number) = LOWER(?) OR LOWER(course) = LOWER(?) OR LOWER(student_name) LIKE LOWER(?)`, [certNumber, certNumber, searchPattern], async (err, rows) => {
        if (err) {
            console.error('DB Error:', err.message);
        }

        let results = [];

        if (rows && rows.length > 0) {
            // Found in DB (by cert number or course)
            results = rows.map(row => {
                const download_url = `https://drive.google.com/uc?export=download&id=${row.google_drive_id}`;
                let driveId = '';
                if (download_url && download_url.includes('id=')) {
                    driveId = download_url.split('id=')[1];
                }
                const previewUrl = driveId ? `https://drive.google.com/file/d/${driveId}/preview` : (download_url || '#');
                
                return {
                    id: row.id,
                    cert_number: row.cert_number,
                    student_name: row.student_name,
                    course: row.course,
                    download_url: download_url,
                    preview_url: previewUrl
                };
            });
        }

        // FALLBACK/SUPPLEMENT: Search Google Drive directly by partial name/filename
        try {
            const driveFiles = await driveService.findFilesByName(certNumber);
            if (driveFiles && driveFiles.length > 0) {
                const driveResults = driveFiles.map(file => ({
                    id: 0,
                    cert_number: file.name.split('-')[0] || file.name, // Extract cert number if possible
                    student_name: file.name.includes('-') ? file.name.split('-')[1].replace('.pdf', '') : 'Verified Student',
                    download_url: `https://drive.google.com/uc?export=download&id=${file.id}`,
                    preview_url: `https://drive.google.com/file/d/${file.id}/preview`
                }));
                
                // Add unique drive results not already found in DB
                driveResults.forEach(dr => {
                    const exists = results.find(r => r.download_url && dr.download_url && r.download_url.includes(dr.download_url.split('id=')[1]));
                    if (!exists) results.push(dr);
                });
            }
        } catch (driveErr) {
            console.error('Drive Search Error:', driveErr);
        }

        if (results.length > 0) {
            return res.json(results);
        }

        res.status(404).json({ error: 'Certificate not found. Please check your number.' });
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
