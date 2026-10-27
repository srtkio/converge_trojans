FROM python:3.13-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
ENV CONVERGE_DB_URL=sqlite:////data/converge.db
RUN mkdir -p /data
EXPOSE 8000
# PORT is set by Render/Railway; defaults to 8000 locally.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
