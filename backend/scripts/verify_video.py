"""Offline MP4 acceptance using explicitly supplied ffmpeg/ffprobe binaries."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys
import tempfile


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--ffmpeg",type=Path,required=True)
    parser.add_argument("--ffprobe",type=Path,required=True)
    parser.add_argument("--output",type=Path,required=True)
    args=parser.parse_args()
    ffmpeg,ffprobe=args.ffmpeg.resolve(),args.ffprobe.resolve()
    report={"ffprobe_sha256":hashlib.sha256(ffprobe.read_bytes()).hexdigest(),"ffprobe_version":subprocess.check_output([str(ffprobe),"-version"],text=True).splitlines()[0]}
    with tempfile.TemporaryDirectory(prefix="vietstylist-video-smoke-") as temporary:
        base=Path(temporary)
        os.environ.update({"VIETSTYLIST_IGNORE_DOTENV":"1","ENVIRONMENT":"test","DEBUG":"false","DATABASE_URL":"sqlite:///"+str(base/"video.db"),"LOCAL_MEDIA_DIR":str(base/"media"),"LOCAL_MEDIA_ENABLED":"true","JWT_SIGNING_SECRET":secrets.token_urlsafe(48),"R2_ACCOUNT_ID":"","R2_ACCESS_KEY_ID":"","R2_SECRET_ACCESS_KEY":"","GEMINI_API_KEY":"","FFPROBE_PATH":str(ffprobe)})
        sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
        import httpx,botocore.endpoint
        async def deny_async(*a,**k):raise AssertionError("Outbound forbidden")
        def deny(*a,**k):raise AssertionError("Outbound forbidden")
        httpx.AsyncHTTPTransport.handle_async_request=deny_async
        httpx.HTTPTransport.handle_request=deny
        botocore.endpoint.Endpoint.make_request=deny
        from fastapi.testclient import TestClient
        from app.main import app
        from app.core.database import Database
        clip=base/"synthetic.mp4"
        subprocess.run([str(ffmpeg),"-v","error","-f","lavfi","-i","color=c=blue:s=64x48:r=10:d=1","-an","-c:v","mpeg4","-movflags","+faststart",str(clip)],check=True,capture_output=True,timeout=30)
        data=clip.read_bytes()
        with TestClient(app) as client:
            auth=client.post("/api/auth/register",json={"email":"video@example.invalid","password":"StrongPassword123!","display_name":"Video smoke"})
            assert auth.status_code==200,auth.text
            headers={"Authorization":"Bearer "+auth.json()["access_token"]}
            def upload(content):
                response=client.post("/api/media/uploads",headers=headers,json={"filename":"clip.mp4","media_type":"video","mime_type":"video/mp4","size_bytes":len(content)})
                assert response.status_code==200,response.text
                session=response.json()
                assert client.post(session["upload_url"],files={"file":("clip.mp4",content,"video/mp4")}).status_code==200
                return session,client.post("/api/media/"+session["media_id"]+"/complete",headers=headers,json={})
            session,response=upload(data)
            assert response.status_code==200,response.text
            row=Database.fetch_one("SELECT * FROM media_assets WHERE id=?",(session["media_id"],))
            assert (row["width"],row["height"],row["duration_ms"],row["status"])==(64,48,1000,"ready")
            assert row["object_key"]!=session["object_key"]
            access=client.get("/api/media/"+session["media_id"]+"/access",headers=headers)
            assert access.status_code==200
            assert client.get(access.json()["access_url"]).content==data
            bad,rejected=upload(data[:64])
            assert rejected.status_code==422,rejected.text
            assert Database.fetch_one("SELECT status FROM media_assets WHERE id=?",(bad["media_id"],))["status"]=="rejected"
            report.update({"valid_upload_complete":200,"verified_width":64,"verified_height":48,"verified_duration_ms":1000,"roundtrip_bytes":len(data),"truncated_mp4_status":422,"passed":True})
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(report,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(report))


if __name__=="__main__":main()
