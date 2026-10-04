FROM python:3.10-slim

WORKDIR /app
COPY ./src /app

RUN pip install --no-cache-dir fastapi uvicorn gunicorn

EXPOSE 6767

# CMD ["gunicorn", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:6767", "--keep-alive", "10", "app:app"]
CMD ["gunicorn", \
     "-w", "4", \
     "-k", "uvicorn.workers.UvicornWorker", \
     "--bind", "0.0.0.0:6767", \
     "--keep-alive", "10", \
     "--access-logfile", "-", \
     "--error-logfile", "-", \
     "--log-level", "info", \
     "app:app"]