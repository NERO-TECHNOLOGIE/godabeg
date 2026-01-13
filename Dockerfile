FROM node:18-bullseye

RUN apt-get update && apt-get install -y \
  chromium \
  libgobject-2.0-0 \
  libglib2.0-0 \
  libnss3 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libcups2 \
  libdrm2 \
  libxkbcommon0 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxrandr2 \
  libgbm1 \
  libasound2 \
  libpangocairo-1.0-0 \
  libgtk-3-0 \
  ca-certificates \
  fonts-liberation \
  xdg-utils \
  --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

# 🔴 IMPORTANT : empêcher Puppeteer de télécharger Chromium
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000
CMD ["npm", "start"]
