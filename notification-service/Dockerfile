FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY index.js ./

ENV PORT=5002
EXPOSE 5002

CMD ["node", "index.js"]
