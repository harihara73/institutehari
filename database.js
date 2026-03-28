const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dataDir = process.env.DATA_DIR || __dirname;
const dbPath = path.join(dataDir, 'database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        initializeDatabase();
    }
});

function initializeDatabase() {
    db.serialize(() => {
        // 1. Create the base table if it doesn't exist
        db.run(`CREATE TABLE IF NOT EXISTS certificates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cert_number TEXT UNIQUE NOT NULL,
            student_name TEXT,
            course TEXT,
            file_path TEXT,
            google_drive_id TEXT
        )`, (err) => {
            if (err) console.error('Error creating table:', err.message);
            else console.log('Certificates table verified/created.');
        });

        // 2. Explicitly ensure missing columns exist (MIGRATIONS)
        const columnsToMigrate = [
            { name: 'google_drive_id', type: 'TEXT' },
            { name: 'course', type: 'TEXT' }
        ];

        columnsToMigrate.forEach(col => {
            db.run(`ALTER TABLE certificates ADD COLUMN ${col.name} ${col.type}`, (err) => {
                if (err) {
                    if (err.message.includes('duplicate column name')) {
                        // All good, column already exists
                    } else {
                        console.error(`Migration error (adding ${col.name}):`, err.message);
                    }
                } else {
                    console.log(`Successfully added missing column: ${col.name}`);
                }
            });
        });
    });
}

module.exports = db;
