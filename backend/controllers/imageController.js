const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { cloudinary, extractPublicIdFromUrl } = require('../../../utils/cloudinary');

exports.removeBackground = async (req, res) => {
  if (!req.file) {
    return res.status(400).send('No image file provided.');
  }

  const imagePath = req.file.path; // For Cloudinary storage this is a URL; for buffer we fallback
  const pythonServiceUrl = process.env.PYTHON_BG_REMOVER_URL;

  try {
    const formData = new FormData();
    // If imagePath is a Cloudinary URL, fetch the bytes first
    if (/^https?:\/\//.test(imagePath)) {
      const imgResp = await axios.get(imagePath, { responseType: 'arraybuffer' });
      formData.append('image', Buffer.from(imgResp.data), 'image.png');
    } else {
      formData.append('image', fs.createReadStream(imagePath));
    }

    const response = await axios.post(pythonServiceUrl, formData, {
      headers: formData.getHeaders(),
      responseType: 'arraybuffer',
    });

    // Upload the background-removed image to Cloudinary
    const uploadRes = await cloudinary.uploader.upload_stream
      ? await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: 'image_ai', resource_type: 'image' },
            (error, result) => (error ? reject(error) : resolve(result))
          );
          stream.end(Buffer.from(response.data));
        })
      : await cloudinary.uploader.upload(`data:image/png;base64,${Buffer.from(response.data).toString('base64')}`, { folder: 'image_ai' });

    res.json({ newImageUrl: uploadRes.secure_url });
  } catch (error) {
    console.error('Error calling Python service:', error.message);
    res.status(500).send('Failed to remove background.');
  }
};

exports.deleteImages = async (req, res) => {
  const { originalUrl, editedUrl } = req.body;
  try {
    const targets = [originalUrl, editedUrl].filter(Boolean);
    for (const url of targets) {
      if (!/^https?:\/\//.test(url)) continue;
      const publicId = extractPublicIdFromUrl(url);
      if (publicId) {
        await cloudinary.uploader.destroy(publicId, { invalidate: true });
      }
    }
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: err?.message || String(err) });
  }
};

exports.saveEditedImage = async (req, res) => {
  // Expects: req.body.originalUrl, file (edited image via multer to Cloudinary)
  const { originalUrl } = req.body;
  if (!req.file || !originalUrl) {
    return res.status(400).json({ error: 'Missing file or originalUrl' });
  }
  try {
    // multer-storage-cloudinary already uploaded; file.path is secure_url
    return res.json({ editedUrl: req.file.path });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Failed to save edited image' });
  }
};

exports.deleteEditedImage = async (req, res) => {
  // Expects: req.body.editedUrl
  const { editedUrl } = req.body;
  if (!editedUrl) return res.json({ success: true });
  try {
    if (/^https?:\/\//.test(editedUrl)) {
      const publicId = extractPublicIdFromUrl(editedUrl);
      if (publicId) await cloudinary.uploader.destroy(publicId, { invalidate: true });
    }
    return res.json({ success: true });
  } catch (err) {
    return res.json({ success: false, error: err?.message || String(err) });
  }
};
