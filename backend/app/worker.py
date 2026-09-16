import os
import sys
import time
import json
import uuid
import logging
from datetime import datetime, timezone
from app.core.config import settings
from app.core.database import init_database, Database
from app.infrastructure.r2.client import r2_client
from app.modules.try_on.repository import TryOnRepository

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] [Worker] %(message)s")
logger = logging.getLogger("worker")


def process_single_job(job: dict):
    job_id = job["id"]
    logger.info(f"Đang xử lý job: {job_id} (Task: {job['task_type']})")

    TryOnRepository.update_job_failed(
        job_id, "Thử đồ AI chưa được tích hợp. Vui lòng sử dụng bản phối Studio."
    )
    logger.info("Job %s kết thúc: chưa có dịch vụ tạo ảnh thử đồ", job_id)


def run_worker_loop():
    logger.info("Khởi động tiến trình Viet Phuc Remix Background Worker...")
    init_database()

    while True:
        try:
            job = TryOnRepository.claim_queued_job(worker_lease_seconds=60)
            if job:
                process_single_job(job)
            else:
                time.sleep(settings.WORKER_POLL_INTERVAL_SECONDS)
        except KeyboardInterrupt:
            logger.info("Dừng worker theo tín hiệu người dùng.")
            break
        except Exception as e:
            logger.error(f"Lỗi vòng lặp worker: {e}")
            time.sleep(settings.WORKER_POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    run_worker_loop()
