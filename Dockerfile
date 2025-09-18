# Multi-process container for image_AI (Node + Python via PM2)

FROM node:18-bullseye-slim

# Install Python 3 and pip (needed for Flask + rembg)
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip \
  && rm -rf /var/lib/apt/lists/*

# Install PM2 for managing multiple processes
RUN npm install -g pm2@5

WORKDIR /app

# ------------------------------
# Install Node (backend) deps first for better layer caching
# ------------------------------
COPY backend/package*.json ./backend/
WORKDIR /app/backend
# Prefer npm ci if lockfile exists; fallback to npm install
RUN npm ci --omit=dev || npm install --production \
  && npm install --no-save dotenv ejs

# ------------------------------
# Install Python deps
# ------------------------------
WORKDIR /app
COPY python-service/requirements.txt ./python-service/requirements.txt
RUN python3 -m pip install --no-cache-dir -r python-service/requirements.txt

# ------------------------------
# Copy application source
# ------------------------------
COPY . .
COPY ecosystem.config.js ./ecosystem.config.js

# Default env (Railway will override as needed)
ENV IMAGE_AI_PORT=3000
ENV PYTHON_BG_REMOVER_URL=http://localhost:5001/remove-bg

# Expose Node backend port
EXPOSE 3000

# Optional container-level healthcheck (no app code change required)
HEALTHCHECK --interval=30s --timeout=5s --retries=5 CMD node -e "require('http').get('http://localhost:3000/', r=>{process.exit(r.statusCode===200?0:1)}).on('error', ()=>process.exit(1))"

# Start both Node and Python with PM2 runtime
CMD ["pm2-runtime", "start", "ecosystem.config.js"]


