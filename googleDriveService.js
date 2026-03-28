const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Load credentials from environment variable or local file
const SCOPES = ['https://www.googleapis.com/auth/drive'];

async function getDriveService() {
    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        'https://developers.google.com/oauthplayground' // Redirect URI
    );

    oauth2Client.setCredentials({
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN
    });

    return google.drive({ version: 'v3', auth: oauth2Client });
}

async function uploadFile(fileBuffer, fileName, mimeType) {
    const drive = await getDriveService();
    
    // Optional: Get folder ID from env
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    
    const fileMetadata = {
        name: fileName,
        parents: folderId ? [folderId] : [],
    };
    
    const media = {
        mimeType: mimeType,
        body: require('stream').Readable.from(fileBuffer),
    };
    
    const response = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, webViewLink, webContentLink',
        supportsAllDrives: true,
    });
    
    // Make file readable by anyone with the link (optional but usually needed for public access)
    await drive.permissions.create({
        fileId: response.data.id,
        requestBody: {
            role: 'reader',
            type: 'anyone',
        },
        supportsAllDrives: true,
    });

    return response.data;
}

async function findFileByName(fileName) {
    const drive = await getDriveService();
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    
    // Search for a file with the given name (case insensitive or partial match can be adjusted)
    // We search for files that start with the cert number
    const q = `'${folderId}' in parents and name contains '${fileName}' and trashed = false`;
    
    const response = await drive.files.list({
        q: q,
        fields: 'files(id, name, webViewLink)',
        spaces: 'drive',
    });

    return response.data.files[0] || null; // Return the first match
}

module.exports = {
    uploadFile,
    findFileByName,
};
