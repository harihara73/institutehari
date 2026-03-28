const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dataDir = process.env.DATA_DIR || __dirname;
const dbPath = path.join(dataDir, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        db.run(`CREATE TABLE IF NOT EXISTS certificates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cert_number TEXT UNIQUE NOT NULL,
            student_name TEXT,
            file_path TEXT,
            google_drive_id TEXT
        )`, (err) => {
            if (err) {
                console.error('Error creating table', err.message);
            } else {
                // Migration: Add google_drive_id if it doesn't exist (handles existing databases)
                db.run(`ALTER TABLE certificates ADD COLUMN google_drive_id TEXT`, (err) => {
                    if (err && !err.message.includes('duplicate column name')) {
                        console.error('Error migrating table', err.message);
                    }
                });
            }
        });
    }
});

module.exports = db;
