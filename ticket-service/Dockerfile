FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY index.js ./
COPY routes ./routes

ENV PORT=5001
EXPOSE 5001

CMD ["node", "index.js"]
