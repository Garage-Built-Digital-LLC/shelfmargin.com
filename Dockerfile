# ShelfMargin — self-contained local build preview.
# Builds the app inside the image and serves the built output.
# No host bind-mounts and no node_modules volume, so nothing can go stale.
FROM node:22-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 4173
CMD ["node", "server.mjs"]
