# Multi-process container for image_AI (Node + Python via PM2)

FROM node:18-bullseye-slim

# Install Python 3 and pip (needed for Flask + rembg)
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip libgomp1 \
  && rm -rf /var/lib/apt/lists/*

# Install PM2 for managing multiple processes
RUN npm install -g pm2@5

WORKDIR /app

# ------------------------------
# Install Node (backend) deps first for better layer caching
# ------------------------------
COPY backend/package*.json ./image_AI/backend/
WORKDIR /app/image_AI/backend
# Prefer npm ci if lockfile exists; fallback to npm install
RUN npm ci --omit=dev || npm install --production \
  && npm install --no-save dotenv ejs

# ------------------------------
# Install Python deps
# ------------------------------
WORKDIR /app
COPY python-service/requirements.txt ./image_AI/python-service/requirements.txt
RUN python3 -m pip install --no-cache-dir -r image_AI/python-service/requirements.txt

# Ensure Node can resolve modules from anywhere (utils requires cloudinary from /app)
ENV NODE_PATH=/app/node_modules:/app/image_AI/backend/node_modules
RUN ln -sf /app/image_AI/backend/node_modules /app/node_modules

# ------------------------------
# Copy application source
# ------------------------------
COPY . ./image_AI
# Provide utils at /app/utils to satisfy '../../../utils/cloudinary' require path
COPY utils ./utils
COPY ecosystem.config.js ./ecosystem.config.js

# Default env (Railway will override as needed)
ENV IMAGE_AI_PORT=3000
ENV PYTHON_BG_REMOVER_URL=http://127.0.0.1:5001/remove-bg

# Expose Node backend port
EXPOSE 3000

# Optional container-level healthcheck (no app code change required)
HEALTHCHECK --interval=30s --timeout=5s --retries=5 CMD bash -c 'exec 3<>/dev/tcp/127.0.0.1/3000 && echo ok >&3 && exec 3<&- && exec 3>&-'

# Start both Node and Python with PM2 runtime
CMD ["pm2-runtime", "start", "ecosystem.config.js"]


