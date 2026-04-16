FROM node:20-alpine

WORKDIR /app

# Install deps first (better caching)
COPY package*.json ./
RUN npm ci --only=production

# Copy app
COPY . .

# Set env
ENV NODE_ENV=production

# Expose port (optional but clean)
EXPOSE 3000

CMD ["npm", "start"]