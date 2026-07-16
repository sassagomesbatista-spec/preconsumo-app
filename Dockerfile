FROM node:20-slim

ENV NODE_ENV=production

WORKDIR /app

COPY package.json ./
RUN npm install --include=dev --legacy-peer-deps

COPY . .
RUN npm run build

EXPOSE 3001
CMD ["npm", "start"]
