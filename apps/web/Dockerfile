# Keputusan pnpm-vs-npm: repo memakai pnpm workspace (pnpm-lock.yaml di root,
# packageManager pnpm@9.12.0, tidak ada package-lock.json). Dockerfile memakai
# corepack + pnpm agar lockfile dihormati dan build reproduksibel.
# Catatan: konteks build compose = ./apps/web (bukan root), jadi workspace file
# disalin agar pnpm tidak protes soal lockfile di luar project.
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/package.json
RUN pnpm install --filter @yutria3d/web --frozen-lockfile
COPY apps/web ./apps/web
WORKDIR /app/apps/web
# VITE_API_URL dibakar ke bundle saat build; sediakan default lokal bila tidak diisi.
ARG VITE_API_URL=http://localhost:5000
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm build

FROM nginx:alpine
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
