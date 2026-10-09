# Etapa 1: compila la web app
FROM node:22-alpine AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# Etapa 2: API + web compilada en una sola imagen
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY despensa ./despensa
COPY api ./api
COPY data/catalogo_walmart.csv ./data/catalogo_walmart.csv
COPY --from=web /web/dist ./web/dist

ENV PORT=8000
EXPOSE 8000
CMD ["sh", "-c", "uvicorn api.app:app --host 0.0.0.0 --port ${PORT}"]
