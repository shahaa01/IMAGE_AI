// backend/app.js
const express = require('express');
const cors = require('cors');
const path = require('path');
// Ensure Cloudinary env vars from Velvra root are available when running this service
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const imagesRouter = require('./routes/images');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Set EJS as the view engine and configure views/static paths
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../frontend/views'));
app.use(express.static(path.join(__dirname, '../frontend/public')));

// No local uploads; using Cloudinary now.

// Image routes
app.use('/images', imagesRouter);

// Render the main upload page at root
app.get('/', (req, res) => {
  res.render('index');
});

const PORT = process.env.IMAGE_AI_PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
