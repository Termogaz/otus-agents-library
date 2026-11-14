# Три стадии: сборка, API на Node и nginx со статикой (HW4-4, D-14).
# Контекст целиком копируется только в стадию build; финальные образы берут из неё готовое.

FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npx tsc -p tsconfig.server.json

FROM node:24-alpine AS api
WORKDIR /app
ENV NODE_ENV=production PORT=3000 LIBRARY_DATA_FILE=/app/data/library.json
# package.json нужен и для "type": "module": без него .js из dist не загрузятся как ESM
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist/api ./dist/api
COPY data/seed.json /app/seed/seed.json
RUN mkdir -p /app/data && chown node:node /app/data
USER node
# Семя копируется только в пустой том: существующий library.json не перезаписывается
CMD ["sh", "-c", "[ -f \"$LIBRARY_DATA_FILE\" ] || cp /app/seed/seed.json \"$LIBRARY_DATA_FILE\"; exec node dist/api/server/index.js"]

FROM nginx:alpine AS web
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/client /usr/share/nginx/html
