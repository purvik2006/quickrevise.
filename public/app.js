const API_URL = 'http://localhost:3000/api';
let token = localStorage.getItem('token');
let userEmail = localStorage.getItem('email'); 

// ADDED: This is required to track which note is currently open!
let currentNoteId = null; 

if (token) { showApp(); fetchNotes(); }

async function handleAuth(type) {
    const emailInput = document.getElementById('auth-email').value; 
    const passInput = document.getElementById('auth-password').value;
    const msg = document.getElementById('auth-msg');

    const res = await fetch(`${API_URL}/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput, password: passInput }) 
    });

    const data = await res.json();
    
    if (res.ok) {
        if (type === 'login') {
            token = data.token; 
            userEmail = data.email;
            localStorage.setItem('token', token); 
            localStorage.setItem('email', userEmail);
            showApp(); 
            fetchNotes();
        } else {
            msg.style.color = '#10b981'; 
            msg.innerText = 'Success! You can now log in.';
        }
    } else {
        msg.style.color = '#ef4444'; 
        msg.innerText = data.message;
    }
}

function showApp() {
    document.getElementById('auth-wrapper').classList.add('hidden');
    document.getElementById('app-wrapper').classList.remove('hidden');
    document.getElementById('user-display').innerText = userEmail; 
}

// Fixed duplicate logout function
function logout() { 
    localStorage.clear(); 
    location.reload(); 
}

// Text Formatting Toolbar
function formatText(command) {
    document.execCommand(command, false, null);
    document.getElementById('editor').focus();
}

// Templates setup 
function loadTemplate() {
    const val = document.getElementById('template-select').value;
    const editor = document.getElementById('editor');
    const title = document.getElementById('note-title');
    
    if (val === 'eng-graphics') {
        title.value = "Engineering Graphics - Solid Edge Notes";
        editor.innerHTML = `<h3>Problem Statement:</h3><p><br></p><h3>Alpha / Beta Inclination Calculations:</h3><ul><li>True Length (TL) = </li><li>Apparent Length = </li></ul><h3>Solid Edge Commands Used:</h3><ul><li><br></li></ul><p><em>(Paste your line projection diagrams below)</em></p>`;
    } else if (val === 'iot') {
        title.value = "IoT Sensing Solutions";
        editor.innerHTML = `<h3>Sensor Selection Criteria</h3><ul><li><strong>Accuracy:</strong> </li><li><strong>Range:</strong> </li><li><strong>Power Consumption:</strong> </li><li><strong>Environmental factors:</strong> </li></ul><h3>Architecture Diagram:</h3><p><br></p>`;
    } else if (val === 'blank') {
        title.value = "";
        editor.innerHTML = "";
    }
    document.getElementById('template-select').value = ""; 
}

// Paste Image
document.getElementById('editor').addEventListener('paste', (e) => {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (let item of items) {
        if (item.kind === 'file' && item.type.includes('image')) {
            const blob = item.getAsFile();
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = document.createElement('img');
                img.src = event.target.result;
                document.getElementById('editor').appendChild(img);
            };
            reader.readAsDataURL(blob);
        }
    }
});

function embedVideo() {
    const url = document.getElementById('video-url').value.trim();
    if (!url) return;
    const editor = document.getElementById('editor');
    
    const card = document.createElement('div');
    card.className = 'video-card';
    card.contentEditable = "false"; 
    card.innerHTML = `🎥 <strong>Video Link:</strong> <a href="${url}" target="_blank">${url}</a>`;
    
    editor.appendChild(card);
    const emptyLine = document.createElement('p');
    emptyLine.innerHTML = '<br>';
    editor.appendChild(emptyLine);
    
    const range = document.createRange();
    const selection = window.getSelection();
    range.setStart(emptyLine, 0); range.collapse(true);
    selection.removeAllRanges(); selection.addRange(range);
    
    document.getElementById('video-url').value = '';
}

// Fetch Notes for Sidebar
async function fetchNotes() {
    const res = await fetch(`${API_URL}/notes`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (res.ok) {
        const notes = await res.json();
        const list = document.getElementById('notes-list');
        list.innerHTML = '';

        notes.forEach(note => {
            list.innerHTML += `
                <div class="note-item">
                    <span
                        style="flex:1; cursor:pointer;"
                        onclick="openNote(${note.id})"
                    >
                        ${note.title || 'Untitled'}
                    </span>
                    <button
                        class="del-btn"
                        onclick="deleteNote(${note.id})"
                    >
                        Del
                    </button>
                </div>
            `;
        });
    }
}

async function openNote(id) {
    const res = await fetch(`${API_URL}/notes/${id}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (res.ok) {
        const note = await res.json();
        document.getElementById('note-title').value = note.title;
        document.getElementById('editor').innerHTML = note.content;
        currentNoteId = id;
    } else {
        alert('Could not open note.');
    }
}

function startNewNote() {
    document.getElementById('note-title').value = '';
    document.getElementById('editor').innerHTML = '';
    currentNoteId = null;
}

async function saveNote() {
    const title = document.getElementById('note-title').value || 'Untitled';
    const content = document.getElementById('editor').innerHTML;
    const saveBtn = document.querySelector('.save-btn');

    saveBtn.innerText = 'Saving...';

    try {
        if (currentNoteId) {
            // UPDATE EXISTING NOTE
            const res = await fetch(
                `${API_URL}/notes/${currentNoteId}`,
                {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        title: title,
                        content: content
                    })
                }
            );

            const data = await res.json();
            if (!res.ok) {
                alert(data.message);
                return;
            }

        } else {
            // CREATE NEW NOTE
            const res = await fetch(
                `${API_URL}/notes`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        title: title,
                        content: content
                    })
                }
            );

            const data = await res.json();
            if (!res.ok) {
                alert(data.message);
                return;
            }

            // Remember the new note's ID
            currentNoteId = data.noteId;
        }

        fetchNotes();

    } catch (error) {
        console.error(error);
        alert('Could not save note.');
    } finally {
        saveBtn.innerText = '💾 Save';
    }
}

async function deleteNote(id) {
    if(!confirm("Delete this note?")) return;
    
    await fetch(`${API_URL}/notes/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    
    // UPDATED: Clears the screen if you delete the note you are currently reading
    if (currentNoteId === id) {
        startNewNote(); 
    } else {
        fetchNotes();
    }
}

function exportToPDF() {
    const title = document.getElementById('note-title').value || 'Exam_Notes';
    const element = document.getElementById('editor');
    const opt = {
        margin: 15, filename: `${title.replace(/\s+/g, '_')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
}

// PDF Upload Logic (Creates a link instead of an iframe)
async function uploadPDF(event) {
    const file = event.target.files[0];
    if (!file) return;

    const uploadBtn = document.querySelector('button[onclick="document.getElementById(\'pdf-upload\').click()"]');
    const originalText = uploadBtn.innerText;
    uploadBtn.innerText = "⏳ Uploading...";

    const formData = new FormData();
    formData.append('pdf', file);

    try {
        const res = await fetch(`${API_URL}/upload`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }, 
            body: formData
        });
        
        const data = await res.json();
        
        if (res.ok) {
            const editor = document.getElementById('editor');
            const pdfCard = document.createElement('div');
            pdfCard.contentEditable = "false";
            
            // This injects a clickable link block
            pdfCard.innerHTML = `
                <div style="margin: 15px 0; padding: 12px 16px; border: 1px solid #cbd5e1; border-radius: 6px; background: #f8fafc; display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 20px;">📄</span>
                    <a href="${data.url}" target="_blank" style="color: #4f46e5; font-weight: 600; text-decoration: underline;">
                        Click here to view PDF: ${file.name}
                    </a>
                </div>
            `;
            
            editor.appendChild(pdfCard);
            
            const emptyLine = document.createElement('p');
            emptyLine.innerHTML = '<br>';
            editor.appendChild(emptyLine);
            
            const range = document.createRange();
            const selection = window.getSelection();
            range.setStart(emptyLine, 0); 
            range.collapse(true);
            selection.removeAllRanges(); 
            selection.addRange(range);
        } else {
            alert("Server Error: " + data.message);
        }
    } catch (err) {
        console.error("Fetch error details:", err);
        alert('Failed to upload PDF. Check your console.');
    }
    
    uploadBtn.innerText = originalText;
    event.target.value = ''; 
}