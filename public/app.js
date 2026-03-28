document.addEventListener('DOMContentLoaded', () => {
    
    // ======== Configuration ========
    // IMPORTANT: Swap this with your Render.com URL after you deploy the backend!
    // Example: const API_URL = 'https://your-app.onrender.com';
    const API_URL = window.location.origin === 'http://localhost:3000' ? '' : 'https://your-app-on-render.onrender.com';
    
    
    // ======== Admin Upload Form ========
    const uploadForm = document.getElementById('uploadForm');
    if (uploadForm) {
        uploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const certNumber = document.getElementById('certNumber').value;
            const studentName = document.getElementById('studentName').value;
            const fileInput = document.getElementById('certificatePdf').files[0];
            const resultDiv = document.getElementById('uploadResult');

            if (!certNumber || !fileInput) {
                showMessage(resultDiv, 'Please provide both Certificate Number and PDF.', 'error');
                return;
            }

            const formData = new FormData();
            formData.append('cert_number', certNumber);
            formData.append('student_name', studentName);
            formData.append('certificate', fileInput);

            try {
                const response = await fetch(`${API_URL}/admin/upload`, {
                    method: 'POST',
                    body: formData
                });
                
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.error || 'Failed to upload certificate.');
                }

                showMessage(resultDiv, 'Certificate uploaded securely and successfully!', 'success');
                uploadForm.reset();
            } catch (err) {
                showMessage(resultDiv, err.message, 'error');
            }
        });
    }

    // ======== Public Search Form ========
    const searchForm = document.getElementById('searchForm');
    if (searchForm) {
        searchForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const certNumber = document.getElementById('searchCertNumber').value.trim();
            const resultBox = document.getElementById('searchResult');
            
            if (!certNumber) return;

            try {
                const response = await fetch(`${API_URL}/api/search/${encodeURIComponent(certNumber)}`);
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Certificate not found.');
                }

                // Render success details
                resultBox.className = 'result-box';
                resultBox.innerHTML = `
                    <div class="cert-details">
                        <h3>Certificate Found!</h3>
                        <p><strong>ID:</strong> ${data.cert_number}</p>
                        ${data.student_name ? `<p><strong>Name:</strong> ${data.student_name}</p>` : ''}
                        <a href="${data.download_url}" class="download-btn" target="_blank" download>
                            Download Document (PDF)
                        </a>
                    </div>
                `;
            } catch (err) {
                // Render error details
                resultBox.className = 'result-box';
                resultBox.innerHTML = `
                    <div class="result-message error" style="display:block; margin:0">
                        ${err.message}
                    </div>
                `;
            }
        });
    }

    function showMessage(element, text, type) {
        element.textContent = text;
        element.className = `result-message ${type}`;
    }

});
