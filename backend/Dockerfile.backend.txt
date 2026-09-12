# =============================================================
# Dockerfile для backend'а (Python/FastAPI).
# Сохраните как "Dockerfile" (без расширения) в папке backend/.
# =============================================================

FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8080

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
