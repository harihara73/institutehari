# Certificate Database System

This is a premium, secure system for storing and verifying student certificates. 

## Requirements
You must have **[Node.js](https://nodejs.org/)** installed on your computer or server to run this application.

## How to Run Locally

1. **Install Dependencies**
   Open a terminal (Command Prompt or PowerShell) in this folder and run:
   ```bash
   npm install
   ```

2. **Start the Database and Server**
   Run the following command to start the Express server and initialize the SQLite database:
   ```bash
   node server.js
   ```

3. **Access the System**
   - **Public Verifier:** Open your browser and go to `http://localhost:3000/`
   - **Admin Portal:** Open your browser and go to `http://localhost:3000/admin.html` (Use this to securely upload PDFs and assign them unique IDs).

## Features Designed
- **SQLite Local Database:** Automatically creates `database.sqlite` for mapping Certificate IDs -> PDF files.
- **Secure File Storage:** PDFs uploaded via the admin portal are stored safely in an `uploads/` directory.
- **Premium Aesthetics:** Uses modern UI elements like glassmorphism and subtle animations (Inter font, flexbox design).
