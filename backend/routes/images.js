const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getCloudinaryStorage, cloudinary, extractPublicIdFromUrl } = require('../../../utils/cloudinary');
const { removeBackground, deleteImages, saveEditedImage, deleteEditedImage } = require('../controllers/imageController');

const router = express.Router();

// Cloudinary storage config
const storage = getCloudinaryStorage('image_ai');
const upload = multer({ storage });
const uploadEdit = multer({ storage });

// POST /images/upload (multiple images) -> return Cloudinary URLs
router.post('/upload', upload.array('images', 7), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files were uploaded.' });
  }
  const urls = req.files.map(file => file.path);
  res.json({ message: 'Files uploaded successfully!', files: urls });
});

// POST /images/remove-bg (single image)
router.post('/remove-bg', upload.single('image'), removeBackground);

// POST /images/delete (delete original and bg-removed from Cloudinary)
router.post('/delete', deleteImages);

// POST /images/save-edit (save/overwrite edited image in Cloudinary)
router.post('/save-edit', uploadEdit.single('image'), saveEditedImage);
// POST /images/delete-edit (delete edited image from Cloudinary)
router.post('/delete-edit', deleteEditedImage);

module.exports = router;
