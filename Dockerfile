# ShelfMargin — self-contained local build preview.
# Builds the app inside the image and serves the built output.
# No host bind-mounts and no node_modules volume, so nothing can go stale.
FROM node:22
WORKDIR /app

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_STRIPE_PUBLISHABLE_KEY
ARG VITE_USE_LIVE

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_STRIPE_PUBLISHABLE_KEY=$VITE_STRIPE_PUBLISHABLE_KEY
ENV VITE_USE_LIVE=$VITE_USE_LIVE

COPY package.json package-lock.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 4173
CMD ["node", "server.mjs"]
