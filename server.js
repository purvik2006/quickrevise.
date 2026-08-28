const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;
const SECRET_KEY = "your_jwt_secret_key_change_in_prod";

app.use(cors());
app.use(express.json({ limit: '50mb' })); 
app.use(express.static(path.join(__dirname, 'public')));

// Database setup (UPDATED to use email)
const db = new sqlite3.Database('./database.db');
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE, password TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, title TEXT, content TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id))`);
});

// Middleware (Keep your authenticateToken function exactly the same)
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Access denied.' });
    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ message: 'Invalid session.' });
        req.user = user;
        next();
    });
}

// Auth Routes (UPDATED to use email)
app.post('/api/register', async (req, res) => {
    const { email, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.run('INSERT INTO users (email, password) VALUES (?, ?)', [email, hashedPassword], function(err) {
            if (err) return res.status(400).json({ message: 'Email already exists.' });
            res.status(201).json({ message: 'Account created!' });
        });
    } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
        if (err || !user) return res.status(400).json({ message: 'Email not found.' });
        
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(403).json({ message: 'Incorrect password.' });
        
        const token = jwt.sign({ id: user.id, email: user.email }, SECRET_KEY, { expiresIn: '7d' });
        res.json({ token, email: user.email }); // Send email back to frontend
    });
});

// Notes Routes
app.post('/api/notes', authenticateToken, (req, res) => {
    const { title, content } = req.body;
    db.run('INSERT INTO notes (user_id, title, content) VALUES (?, ?, ?)', [req.user.id, title, content], function (err) {
        if (err) return res.status(500).json({ message: 'Could not save note.' });
        res.json({ message: 'Note saved successfully!', noteId: this.lastID });
    });
});

app.get('/api/notes', authenticateToken, (req, res) => {
    db.all('SELECT id, title, updated_at FROM notes WHERE user_id = ? ORDER BY updated_at DESC', [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ message: 'Failed to notes.' });
        res.json(rows);
    });
});

// NEW: Delete Note Route
app.delete('/api/notes/:id', authenticateToken, (req, res) => {
    db.run('DELETE FROM notes WHERE id = ? AND user_id = ?', [req.params.id, req.user.id], function(err) {
        if (err) return res.status(500).json({ message: 'Failed to delete note.' });
        res.json({ message: 'Note deleted.' });
    });
});

const multer = require('multer');
const fs = require('fs');

// Create uploads folder if it doesn't exist
const uploadDir = path.join(__dirname, 'public', 'uploads');

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Setup Multer storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },

    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_'));
    }
});

const upload = multer({ storage: storage });
// --- A SINGLE NOTE ---
// --- FETCH A SINGLE NOTE ---
app.get('/api/notes/:id', authenticateToken, (req, res) => {

    db.get(
        'SELECT * FROM notes WHERE id = ? AND user_id = ?',
        [req.params.id, req.user.id],
        (err, row) => {

            if (err) {
                return res.status(500).json({
                    message: 'Error fetching note.'
                });
            }

            if (!row) {
                return res.status(404).json({
                    message: 'Note not found.'
                });
            }

            res.json(row);
        }
    );
});


// --- UPDATE AN EXISTING NOTE ---
app.put('/api/notes/:id', authenticateToken, (req, res) => {

    const { title, content } = req.body;

    db.run(
        `UPDATE notes
         SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND user_id = ?`,
        [title, content, req.params.id, req.user.id],

        function(err) {

            if (err) {
                return res.status(500).json({
                    message: 'Failed to update note.'
                });
            }

            res.json({
                message: 'Note updated successfully!'
            });
        }
    );
});


// --- PDF UPLOAD ROUTE ---
app.post(
    '/api/upload',
    authenticateToken,
    upload.single('pdf'),
    (req, res) => {

        if (!req.file) {
            return res.status(400).json({
                message: 'No file uploaded.'
            });
        }

        res.json({
            url: `/uploads/${req.file.filename}`
        });
    }
);


// --- START SERVER ---
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});