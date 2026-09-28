FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

# Install production dependencies
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

# Copy service source code
COPY . .

# Run with unprivileged node user
USER node

CMD ["node", "worker.js"]
