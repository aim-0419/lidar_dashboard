FROM python:3.12-slim-bookworm
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*
COPY dashboard/demo-server/requirements.docker.txt /tmp/requirements.txt
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch==2.11.0 torchvision==0.26.0 \
    && pip install --no-cache-dir -r /tmp/requirements.txt
COPY dashboard/vision-worker/vision_worker ./vision_worker
COPY dashboard/vision-worker/tests ./tests
COPY dashboard/vision-worker/assets/yolo11s.pt /assets/model.pt
COPY dashboard/vision-worker/assets/sc10.mp4 /assets/video.mp4
ENV PYTHONUNBUFFERED=1
ENV OPENCV_FFMPEG_LOGLEVEL=-8 OPENCV_LOG_LEVEL=SILENT
EXPOSE 8890
HEALTHCHECK --interval=15s --timeout=3s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8890/health', timeout=2)"
CMD ["python", "-m", "vision_worker.test_server"]
