FROM python:3.11-slim
WORKDIR /app
COPY proxy.py .
ENV PYTHONUNBUFFERED=1
EXPOSE 9005
CMD ["python", "proxy.py"]