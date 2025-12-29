FROM ghcr.io/puppeteer/puppeteer:latest

WORKDIR /usr/src/app

COPY package*.json ./

USER root
RUN npm install
USER pptruser

COPY . .

CMD [ "node", "index.js" ]