const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function getCloudinaryStorage(folder = 'general', allowedFormats) {
  return new CloudinaryStorage({
    cloudinary,
    params: {
      folder,
      allowed_formats: allowedFormats || ['jpg', 'jpeg', 'png', 'webp'],
      resource_type: 'auto',
      transformation: [{ quality: 'auto' }, { fetch_format: 'auto' }],
    },
  });
}

module.exports = {
  cloudinary,
  getCloudinaryStorage,
  extractPublicIdFromUrl(url) {
    try {
      if (!url || typeof url !== 'string') return null;
      const cleanUrl = url.split('?')[0].split('#')[0];
      const match = cleanUrl.match(/\/upload\/(?:v\d+\/)?(.+?)\.[^/.]+$/);
      if (match && match[1]) {
        return match[1];
      }
      const matchNoExt = cleanUrl.match(/\/upload\/(?:v\d+\/)?(.+)$/);
      return matchNoExt ? matchNoExt[1] : null;
    } catch (_) {
      return null;
    }
  },
  async deleteByUrl(url, options = {}) {
    if (!url || typeof url !== 'string') return { result: 'skipped' };
    const isHttp = url.startsWith('http://') || url.startsWith('https://');
    if (!isHttp) return { result: 'skipped' };
    const publicId = this.extractPublicIdFromUrl(url);
    if (!publicId) return { result: 'not_found' };
    try {
      const res = await cloudinary.uploader.destroy(publicId, {
        invalidate: true,
        resource_type: options.resource_type || 'image'
      });
      return res;
    } catch (err) {
      return { result: 'error', error: err?.message || String(err) };
    }
  }
};


