# Image produksi untuk host berbasis Docker (Koyeb, Hugging Face Spaces, VPS, dll.).
# Render tidak memerlukan file ini karena memakai runtime Node native.
FROM node:22.23.4-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY . .
RUN npm run build

FROM node:22.23.4-alpine AS runtime

ENV NODE_ENV=production
ENV PORT=3001

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/src/lib ./src/lib

USER node

EXPOSE 3001

CMD ["npm", "start"]
