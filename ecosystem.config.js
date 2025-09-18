module.exports = {
  apps: [
    {
      name: 'image-ai-node',
      script: 'backend/app.js',
      env: {
        NODE_ENV: 'production',
        IMAGE_AI_PORT: process.env.IMAGE_AI_PORT || 3000,
        PYTHON_BG_REMOVER_URL: process.env.PYTHON_BG_REMOVER_URL || 'http://localhost:5001/remove-bg'
      }
    },
    {
      name: 'image-ai-python',
      script: 'python-service/app.py',
      interpreter: 'python3',
      env: {}
    }
  ]
};


