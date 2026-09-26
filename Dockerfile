FROM node:22-alpine AS build
WORKDIR /src
COPY package*.json ./
RUN npm ci
COPY src src
COPY scripts scripts
COPY examples examples
RUN npm run i18n:validate && npm run build
FROM nginx:1.27-alpine
COPY --from=build /src/dist/extensions/stir /usr/share/nginx/html/extensions/stir
