FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY despensa ./despensa
COPY api ./api
COPY data/catalogo_walmart.csv ./data/catalogo_walmart.csv
# La web app compilada (fase 2) se copiará aquí: COPY web/dist ./web/dist

ENV PORT=8000
EXPOSE 8000
CMD ["sh", "-c", "uvicorn api.app:app --host 0.0.0.0 --port ${PORT}"]
