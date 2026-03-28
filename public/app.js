document.addEventListener('DOMContentLoaded', () => {

    // ======== Configuration ========
    // Use the current origin for API calls if running on the same server, 
    // fallback to production URL if needed.
    const API_URL = window.location.origin.includes('localhost') 
        ? 'http://localhost:3000' 
        : 'https://institutehari.onrender.com';

    // ======== Backend Health Status ========
    const backendStatus = document.getElementById('backendStatus');
    if (backendStatus) {
        fetch(`${API_URL}/`, { credentials: 'include' })
            .then((resp) => resp.text())
            .then((text) => {
                backendStatus.textContent = `Backend Status: ${text}`;
                backendStatus.classList.remove('d-none', 'alert-info');
                backendStatus.classList.add('alert-success');
            })
            .catch((err) => {
                console.error('Backend Health Check Failed:', err);
                backendStatus.textContent = 'Backend Status: Unreachable - please verify deployment and network.';
                backendStatus.classList.remove('d-none', 'alert-info');
                backendStatus.classList.add('alert-warning');
            });
    }

    // ======== Public Search Form ========
    const searchForm = document.getElementById('searchForm');
    const resultBox = document.getElementById('searchResult');
    const loadingSpinner = document.getElementById('loadingSpinner');

    if (searchForm) {
        searchForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const certNumber = document.getElementById('searchCertNumber').value.trim();

            if (!certNumber) return;

            // Show Loading State
            resultBox.classList.add('hidden');
            loadingSpinner.classList.remove('hidden');

            const maxRetries = 3;
            let attempt = 0;
            let response = null;

            while (attempt < maxRetries) {
                try {
                    attempt++;
                    response = await fetch(`${API_URL}/api/search/${encodeURIComponent(certNumber)}`, {
                        credentials: 'include'
                    });
                    break; // Success! Exit loop
                } catch (err) {
                    if (attempt === maxRetries) {
                        loadingSpinner.classList.add('hidden');
                        showError("Server timeout. Please wait 10 seconds and try again.");
                        return;
                    }
                    await new Promise(resolve => setTimeout(resolve, 3000));
                }
            }

            loadingSpinner.classList.add('hidden');

            try {
                const results = await response.json();

                if (!response.ok) {
                    throw new Error(results.error || 'Certificate not found.');
                }

                // If results is not an array, wrap it (though server is now updated to return array)
                const dataArray = Array.isArray(results) ? results : [results];

                // Clear previous results
                resultBox.innerHTML = '';

                if (dataArray.length > 1) {
                    const countHeader = document.createElement('div');
                    countHeader.className = 'alert alert-info text-center mb-4 rounded-pill shadow-sm';
                    countHeader.innerHTML = `<i class="fas fa-search me-2"></i> Found <strong>${dataArray.length}</strong> matching certificates`;
                    resultBox.appendChild(countHeader);
                }

                dataArray.forEach(data => {
                    // Render success details using the Premium Layout
                    let driveId = '';
                    if (data.download_url && data.download_url.includes('id=')) {
                        driveId = data.download_url.split('id=')[1];
                    }

                    const previewUrl = driveId ? `https://drive.google.com/file/d/${driveId}/preview` : (data.download_url || '#');
                    
                    const card = document.createElement('div');
                    card.className = 'mb-5'; // Space between multiple results
                    card.innerHTML = `
                        <div class="result-card">
                            <div class="success-badge"><i class="fas fa-check-circle"></i> VERIFIED · VALID CERTIFICATE</div>
                            
                            <div class="student-profile">
                                <div class="photo-area text-center" style="min-width: 160px;">
                                    <img class="student-photo" src="https://ui-avatars.com/api/?background=1f7b8c&color=fff&size=150&name=${encodeURIComponent(data.student_name || 'Verified')}" alt="Student Photo">
                                </div>
                                
                                <div class="details-grid">
                                    <div class="detail-item">
                                        <div class="detail-label"><i class="fas fa-user-graduate me-1"></i> Full Name</div>
                                        <div class="detail-value">${data.student_name || 'Verified Student'}</div>
                                    </div>
                                    <div class="detail-item">
                                        <div class="detail-label"><i class="fas fa-id-card me-1"></i> Certificate ID</div>
                                        <div class="detail-value">${data.cert_number}</div>
                                    </div>
                                    <div class="detail-item">
                                        <div class="detail-label"><i class="fas fa-calendar-check me-1"></i> Status</div>
                                        <div class="detail-value text-success">Active & Verified</div>
                                    </div>
                                </div>
                            </div>

                            <div class="action-buttons d-flex flex-wrap gap-2 mb-4">
                                <a href="${data.download_url}" class="btn btn-primary rounded-pill px-4">
                                   <i class="fas fa-download me-2"></i>Download PDF
                                </a>
                                <button onclick="window.open('${previewUrl}', '_blank')" class="btn btn-secondary rounded-pill px-4">
                                   <i class="fas fa-eye me-2"></i>Preview
                                </button>
                            </div>

                            <!-- PDF Preview Frame -->
                            <div class="preview-box mt-4">
                                <div class="preview-header">
                                    <span><i class="fas fa-file-pdf me-2"></i>Official Document Preview</span>
                                </div>
                                <iframe src="${previewUrl}" width="100%" height="500px" style="border:none;"></iframe>
                            </div>
                        </div>
                    `;
                    resultBox.appendChild(card);
                });

                resultBox.classList.remove('hidden');

            } catch (err) {
                showError(err.message);
            }
        });
    }

    function showError(message) {
        resultBox.innerHTML = `
            <div class="result-card">
                <div class="alert alert-danger border-0 mb-0 py-3" style="background: #fff5f5; border-left: 6px solid #ef4444 !important; border-radius: 12px;">
                    <div class="d-flex align-items-center">
                        <i class="fas fa-exclamation-triangle fa-2x me-3" style="color: #ef4444;"></i>
                        <div>
                            <h5 class="alert-heading fw-bold mb-1" style="color: #991b1b;">Error Found</h5>
                            <p class="mb-0" style="color: #b91c1c;">${message}</p>
                        </div>
                    </div>
                </div>
                <div class="mt-4 ps-1">
                    <p class="fw-bold text-muted mb-2">Troubleshooting Tips:</p>
                    <ul class="text-muted small">
                        <li>Check if the Certificate ID is typed correctly (Example: VCI 68 2025).</li>
                        <li>Ensure you have a stable internet connection.</li>
                        <li>If the problem persists, contact student support.</li>
                    </ul>
                </div>
            </div>
        `;
        resultBox.classList.remove('hidden');
    }

    // ======== Admin Upload Form ========
    const uploadForm = document.getElementById('uploadForm');
    const uploadResult = document.getElementById('uploadResult');

    if (uploadForm) {
        uploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const submitBtn = uploadForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.textContent;
            
            // Show Loading State
            submitBtn.disabled = true;
            submitBtn.textContent = 'Uploading to Secure Drive...';
            uploadResult.innerHTML = '';
            uploadResult.className = 'result-message';

            try {
                const formData = new FormData(uploadForm);
                const response = await fetch(`${API_URL}/admin/upload`, {
                    method: 'POST',
                    body: formData,
                    credentials: 'include'
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Upload failed');
                }

                uploadResult.textContent = '✔ ' + data.message;
                uploadResult.classList.add('success');
                uploadForm.reset();

            } catch (err) {
                console.error('Upload Error:', err);
                uploadResult.textContent = '✖ ' + err.message;
                uploadResult.classList.add('error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = originalBtnText;
            }
        });
    }

});
