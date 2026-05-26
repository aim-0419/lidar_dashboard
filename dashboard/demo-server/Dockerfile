FROM python:3.12-slim-bookworm

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
  && rm -rf /var/lib/apt/lists/*

COPY dashboard/demo-server/requirements.docker.txt ./dashboard/demo-server/requirements.docker.txt
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch==2.11.0 torchvision==0.26.0 \
  && pip install --no-cache-dir -r dashboard/demo-server/requirements.docker.txt

COPY dashboard/demo-server ./dashboard/demo-server
COPY dashboard/demo-server/config.docker.json ./dashboard/demo-server/config.json
COPY dashboard/dashboard-web/public/wrongway_test.mp4 ./dashboard/dashboard-web/public/wrongway_test.mp4

WORKDIR /app/dashboard/demo-server

EXPOSE 8888

CMD ["python", "-u", "wrongway_detector.py"]
