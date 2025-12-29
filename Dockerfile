FROM ghcr.io/puppeteer/puppeteer:latest

WORKDIR /usr/src/app

# Copy package info
COPY package*.json ./

# Install dependencies
USER root
RUN npm install
USER pptruser

# Copy source code
COPY . .

CMD [ "node", "index.js" ]