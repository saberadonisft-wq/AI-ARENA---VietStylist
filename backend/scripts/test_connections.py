import sys
import os
import json

# Thêm thư mục backend vào sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

from app.core.config import Settings

def test_all():
    print("\n" + "="*55)
    print("🔍 KIỂM TRA KẾT NỐI SUPABASE & CLOUDFLARE R2")
    print("="*55 + "\n")

    # Load fresh settings directly from .env
    settings = Settings(_env_file=".env")

    # 1. KIỂM TRA CLOUDFLARE R2
    print("📦 [1/2] Đang kiểm tra Cloudflare R2 Object Storage...")
    r2_configured = bool(settings.R2_ACCOUNT_ID and settings.R2_ACCESS_KEY_ID and settings.R2_SECRET_ACCESS_KEY)
    
    if not r2_configured:
        print("  ⚠️  Chưa cấu hình đầy đủ thông tin R2 trong backend/.env:")
        print(f"     - R2_ACCOUNT_ID: {'✅ Đã có' if settings.R2_ACCOUNT_ID else '❌ Đang để trống'}")
        print(f"     - R2_ACCESS_KEY_ID: {'✅ Đã có' if settings.R2_ACCESS_KEY_ID else '❌ Đang để trống'}")
        print(f"     - R2_SECRET_ACCESS_KEY: {'✅ Đã có' if settings.R2_SECRET_ACCESS_KEY else '❌ Đang để trống'}")
        print(f"     - R2_BUCKET_PUBLIC: {settings.R2_BUCKET_PUBLIC or '❌ Đang để trống'}")
        print("     -> Hiện tại hệ thống đang dùng fallback: Bộ nhớ cục bộ ./media_storage")
    else:
        try:
            import boto3
            from botocore.config import Config

            endpoint_url = f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
            s3 = boto3.client(
                "s3",
                endpoint_url=endpoint_url,
                aws_access_key_id=settings.R2_ACCESS_KEY_ID,
                aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
                region_name="auto",
                config=Config(signature_version="s3v4"),
            )

            target_bucket = settings.R2_BUCKET_PUBLIC
            print(f"  🎯 Đang kiểm tra quyền truy cập Bucket: '{target_bucket}'...")

            # Thử head_bucket hoặc list_objects_v2 trên bucket cụ thể
            try:
                s3.head_bucket(Bucket=target_bucket)
                print(f"  ✅ Kết nối thành công tới Bucket '{target_bucket}' trên Cloudflare R2!")
            except Exception as hb_err:
                print(f"  ⚠️  head_bucket: {hb_err}")

            # Thử upload test object
            test_key = "_connectivity_test.txt"
            s3.put_object(
                Bucket=target_bucket,
                Key=test_key,
                Body=b"VietStylist R2 Connection Verified Successfully",
                ContentType="text/plain",
            )
            print(f"  ✅ Quyền GHI (Upload) lên Bucket '{target_bucket}' HOẠT ĐỘNG HOÀN HẢO!")

            # Thử đọc lại object
            get_resp = s3.get_object(Bucket=target_bucket, Key=test_key)
            content = get_resp["Body"].read().decode()
            print(f"  ✅ Quyền ĐỌC (Download) từ Bucket '{target_bucket}' HOẠT ĐỘNG HOÀN HẢO! ({content})")

            # Xóa file test sau khi thử
            try:
                s3.delete_object(Bucket=target_bucket, Key=test_key)
                print(f"  ✅ Quyền XÓA (Delete) object hoạt động tốt.")
            except Exception:
                pass

            if settings.R2_PUBLIC_DOMAIN and "localhost" not in settings.R2_PUBLIC_DOMAIN:
                print(f"  🌐 Tên miền công khai R2: {settings.R2_PUBLIC_DOMAIN}")
                # Thử test public URL
                import httpx
                public_test_url = f"{settings.R2_PUBLIC_DOMAIN.rstrip('/')}"
                print(f"  🔗 URL ảnh công khai sẽ có dạng: {public_test_url}/<ten_anh>.png")

        except Exception as e:
            print(f"  ❌ Lỗi khi kết nối tới Cloudflare R2: {str(e)}")

    print("\n" + "-"*55 + "\n")

    # 2. KIỂM TRA SUPABASE DATABASE
    print("🗄️  [2/2] Đang kiểm tra Supabase Database...")
    supabase_configured = bool(settings.SUPABASE_URL and (settings.SUPABASE_ANON_KEY or settings.SUPABASE_SERVICE_ROLE_KEY))
    
    if not supabase_configured:
        print("  ⚠️  Chưa cấu hình Supabase URL / Key trong backend/.env:")
        print(f"     - SUPABASE_URL: {'✅ Đã có' if settings.SUPABASE_URL else '❌ Đang để trống'}")
        print(f"     - SUPABASE_ANON_KEY: {'✅ Đã có' if settings.SUPABASE_ANON_KEY else '❌ Đang để trống'}")
        print(f"     - DATABASE_URL: {settings.DATABASE_URL}")
        print("     -> Hiện tại hệ thống đang dùng fallback: SQLite cục bộ (viet_phuc_remix.db)")
    else:
        try:
            import httpx
            api_key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_ANON_KEY
            headers = {
                "apikey": api_key,
                "Authorization": f"Bearer {api_key}",
            }
            # Gọi health check / rest endpoint của Supabase
            url = f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1/"
            with httpx.Client(timeout=6.0) as client:
                res = client.get(url, headers=headers)
                if res.status_code in (200, 404):
                    print(f"  ✅ Kết nối tới Supabase REST API thành công ({res.status_code})!")
                    print(f"  🔗 Supabase Project URL: {settings.SUPABASE_URL}")
                else:
                    print(f"  ⚠️  Supabase trả về mã HTTP {res.status_code}: {res.text[:120]}")

            if "postgres" in settings.DATABASE_URL.lower():
                host_info = settings.DATABASE_URL.split("@")[-1]
                print(f"  🔌 Đang kiểm tra kết nối PostgreSQL qua Pooler: {host_info}...")
                try:
                    import psycopg
                    conn = psycopg.connect(settings.DATABASE_URL, connect_timeout=8)
                    cur = conn.cursor()
                    cur.execute("SELECT version();")
                    db_ver = cur.fetchone()[0]
                    print(f"  ✅ Kết nối trực tiếp PostgreSQL Supabase THÀNH CÔNG RỰC RỠ!")
                    print(f"  🐘 PostgreSQL Version: {db_ver.split(' on ')[0]}")
                    conn.close()
                except Exception as pg_err:
                    print(f"  ⚠️  Kết nối PostgreSQL: {pg_err}")
            else:
                print(f"  ℹ️  DATABASE_URL hiện tại: {settings.DATABASE_URL}")

        except Exception as e:
            print(f"  ❌ Lỗi khi kết nối tới Supabase: {str(e)}")

    print("\n" + "="*55 + "\n")

if __name__ == "__main__":
    test_all()

