FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json tsconfig.json vite.config.ts index.html ./
RUN npm ci

COPY src ./src

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
