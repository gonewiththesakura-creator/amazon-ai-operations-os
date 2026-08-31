FROM python:3.11-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
COPY apps/api/pyproject.toml ./
COPY apps/api/src ./src
COPY scripts ./scripts
RUN pip install --no-cache-dir .
EXPOSE 8000
CMD ["uvicorn", "amazon_ai_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
