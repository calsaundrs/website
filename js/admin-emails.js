document.addEventListener('DOMContentLoaded', () => {
    const templateSelect = document.getElementById('template-select');
    const emailPreview = document.getElementById('email-preview');
    const sendTestBtn = document.getElementById('send-test-btn');
    const testEmailInput = document.getElementById('test-email-input');

    async function fetchPreview() {
        const templateName = templateSelect.value;
        if (!templateName) return;

        emailPreview.innerHTML = '<p>Loading preview...</p>';

        try {
            const response = await fetch('/.netlify/functions/admin-email-tool', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'preview', templateName: templateName }),
            });

            if (response.ok) {
                const html = await response.text();
                // Use a sandboxed iframe to prevent styles from leaking
                emailPreview.innerHTML = `<iframe srcdoc="${html.replace(/"/g, '&quot;')}" class="w-full h-full border-0"></iframe>`;
            } else {
                emailPreview.innerHTML = `<p class="text-red-500">Error loading preview: ${response.statusText}</p>`;
            }
        } catch (error) {
            emailPreview.innerHTML = `<p class="text-red-500">Error loading preview: ${error.message}</p>`;
        }
    }

    async function sendTestEmail() {
        const templateName = templateSelect.value;
        const email = testEmailInput.value;

        if (!templateName || !email) {
            alert('Please select a template and enter an email address.');
            return;
        }

        sendTestBtn.disabled = true;
        sendTestBtn.textContent = 'Sending...';

        try {
            const response = await fetch('/.netlify/functions/admin-email-tool', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'send', templateName: templateName, email: email }),
            });

            const result = await response.json();

            if (response.ok) {
                alert(result.message);
            } else {
                const errorMessage = result.error ? JSON.stringify(result.error, null, 2) : result.message;
                alert(`Error: ${result.message}\n\nDetails: ${errorMessage}`);
            }
        } catch (error) {
            alert(`Error: ${error.message}`);
        } finally {
            sendTestBtn.disabled = false;
            sendTestBtn.textContent = 'Send';
        }
    }

    templateSelect.addEventListener('change', fetchPreview);
    sendTestBtn.addEventListener('click', sendTestEmail);

    const emailLogsTable = document.getElementById('email-logs-table');

    async function fetchEmailLogs() {
        try {
            const response = await fetch('/.netlify/functions/get-email-logs');
            if (response.ok) {
                const logs = await response.json();
                renderEmailLogs(logs);
            } else {
                emailLogsTable.innerHTML = `<tr><td colspan="5" class="text-red-500">Error loading logs: ${response.statusText}</td></tr>`;
            }
        } catch (error) {
            emailLogsTable.innerHTML = `<tr><td colspan="5" class="text-red-500">Error loading logs: ${error.message}</td></tr>`;
        }
    }

    function renderEmailLogs(logs) {
        if (logs.length === 0) {
            emailLogsTable.innerHTML = '<tr><td colspan="5" class="text-center p-4">No email logs found.</td></tr>';
            return;
        }

        const rows = logs.map(log => `
            <tr class="border-b border-gray-700">
                <td class="p-2">${log.to}</td>
                <td class="p-2">${log.subject}</td>
                <td class="p-2"><span class="${log.status === 'sent' ? 'text-green-500' : 'text-red-500'}">${log.status}</span></td>
                <td class="p-2">${new Date(log.timestamp).toLocaleString()}</td>
                <td class="p-2">
                    <button class="resend-btn text-sm bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded" data-log-id="${log.id}">Resend</button>
                </td>
            </tr>
        `).join('');
        emailLogsTable.innerHTML = rows;
    }

    // Fetch initial preview and logs
    fetchPreview();
    fetchEmailLogs();

    emailLogsTable.addEventListener('click', async (event) => {
        if (event.target.classList.contains('resend-btn')) {
            const button = event.target;
            const logId = button.dataset.logId;

            button.disabled = true;
            button.textContent = 'Sending...';

            try {
                const response = await fetch('/.netlify/functions/resend-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ logId: logId }),
                });

                const result = await response.json();

                if (response.ok) {
                    alert(result.message);
                    // Optionally, refresh the logs to show the new sent email
                    fetchEmailLogs();
                } else {
                    alert(`Error: ${result.message}`);
                }
            } catch (error) {
                alert(`Error: ${error.message}`);
            } finally {
                button.disabled = false;
                button.textContent = 'Resend';
            }
        }
    });
});
