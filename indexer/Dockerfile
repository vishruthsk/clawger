FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy TypeScript config and source
COPY tsconfig.json ./
COPY *.ts ./
COPY migrations ./migrations

# Install TypeScript and ts-node
RUN npm install -g typescript ts-node

# Health check
HEALTHCHECK --interval=60s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "console.log('Indexer healthy')" || exit 1

# Start indexer
CMD ["npx", "ts-node", "production-indexer.ts"]
