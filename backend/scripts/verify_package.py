"""Build a clean wheel, install into a fresh venv and run an installed-package smoke."""

import argparse
import json
import os
from pathlib import Path
import platform
import secrets
import shutil
import subprocess
import sys
import tempfile
import time

SMOKE = r"""
import io,json,os
from pathlib import Path
import app
assert Path(app.__file__).is_relative_to(Path(os.environ['EXPECTED_VENV']))
import httpx,botocore.endpoint
async def deny_async(*a,**k):raise AssertionError('Outbound forbidden')
def deny(*a,**k):raise AssertionError('Outbound forbidden')
httpx.AsyncHTTPTransport.handle_async_request=deny_async
httpx.HTTPTransport.handle_request=deny
botocore.endpoint.Endpoint.make_request=deny
from app.main import app as api
from fastapi.testclient import TestClient
from PIL import Image
from app.core.database import init_database
init_database()
init_database()
with TestClient(api) as client:
    assert client.get('/health').status_code==200
    assert client.get('/ready').status_code==200
    response=client.post('/api/auth/register',json={'email':'smoke@example.invalid','password':'StrongPassword123!','display_name':'Smoke'})
    assert response.status_code==200,response.text
    headers={'Authorization':'Bearer '+response.json()['access_token']}
    assert client.post('/api/outfits',headers=headers,json={'snapshot':{'items':[]}}).status_code==200
    response=client.post('/api/media/uploads',headers=headers,json={'filename':'smoke.png'})
    assert response.status_code==200,response.text
    session=response.json()
    data=io.BytesIO()
    Image.new('RGB',(4,4),'red').save(data,format='PNG')
    assert client.post(session['upload_url'],files={'file':('smoke.png',data.getvalue(),'image/png')}).status_code==200
    response=client.post('/api/media/'+session['media_id']+'/complete',headers=headers,json={})
    assert response.status_code==200,response.text
    assert client.delete('/api/media/'+session['media_id'],headers=headers).status_code==200
print(json.dumps({'installed_path':str(Path(app.__file__)),'smoke':'passed'}))
"""


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--write-constraints", type=Path)
    parser.add_argument("--constraints", type=Path)
    parser.add_argument("--full-tests", action="store_true")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    logs = []

    def run(command, cwd, env=None, timeout=300):
        result = subprocess.run(
            command,
            cwd=cwd,
            env=env,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
        )
        logs.append(
            {
                "command": command,
                "exit_code": result.returncode,
                "stdout": result.stdout,
                "stderr": result.stderr,
            }
        )
        if result.returncode:
            raise RuntimeError(result.stderr[-3000:] or result.stdout[-3000:])
        return result.stdout

    report = {"python": sys.version, "platform": platform.platform(), "steps": logs}
    started = time.perf_counter()
    try:
        with tempfile.TemporaryDirectory(prefix="vietstylist-package-") as temporary:
            base = Path(temporary)
            source = base / "source"
            source.mkdir()
            shutil.copytree(
                root / "app",
                source / "app",
                ignore=shutil.ignore_patterns("__pycache__", "*.pyc"),
            )
            for name in ("pyproject.toml", "README.md"):
                shutil.copy(root / name, source / name)
            wheels = base / "wheels"
            run(
                [
                    sys.executable,
                    "-m",
                    "pip",
                    "wheel",
                    "--no-deps",
                    "--no-build-isolation",
                    "--no-index",
                    "--wheel-dir",
                    str(wheels),
                    str(source),
                ],
                base,
            )
            venv = base / "venv"
            run([sys.executable, "-m", "venv", str(venv)], base)
            python = venv / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
            wheel = next(wheels.glob("*.whl"))
            command = [
                str(python),
                "-m",
                "pip",
                "install",
                "--disable-pip-version-check",
                "--no-input",
                "--timeout",
                "30",
                "--retries",
                "1",
                str(wheel) + "[dev]",
            ]
            if args.constraints:
                command += ["-c", str(args.constraints.resolve())]
            run(command, base)
            run([str(python), "-m", "pip", "check"], base)
            frozen = run([str(python), "-m", "pip", "freeze"], base)
            if args.write_constraints:
                pins = [
                    line
                    for line in frozen.splitlines()
                    if "==" in line and not line.lower().startswith("viet-phuc")
                ]
                args.write_constraints.write_text(
                    "# Resolved and verified on CPython 3.13 / Windows.\n"
                    + "\n".join(sorted(pins, key=str.lower))
                    + "\n",
                    encoding="utf-8",
                )
            env = {
                **os.environ,
                "VIETSTYLIST_IGNORE_DOTENV": "1",
                "ENVIRONMENT": "test",
                "DEBUG": "false",
                "DATABASE_URL": "sqlite:///" + str(base / "smoke.db"),
                "LOCAL_MEDIA_DIR": str(base / "media"),
                "LOCAL_MEDIA_ENABLED": "true",
                "JWT_SIGNING_SECRET": secrets.token_urlsafe(48),
                "R2_ACCOUNT_ID": "",
                "R2_ACCESS_KEY_ID": "",
                "R2_SECRET_ACCESS_KEY": "",
                "GEMINI_API_KEY": "",
                "EXPECTED_VENV": str(venv),
                "PYTHONIOENCODING": "utf-8",
            }
            report["smoke"] = json.loads(run([str(python), "-c", SMOKE], base, env))
            if args.full_tests:
                report["full_suite"] = run([str(python),"-m","pytest",str(root/"tests"),"-o","addopts=","-q"],root.parent,env)
            report["passed"] = True
    except Exception as exc:
        report["passed"] = False
        report["error"] = str(exc)
    report["elapsed_seconds"] = time.perf_counter() - started
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(
        json.dumps(
            {
                "passed": report["passed"],
                "output": str(args.output),
                "error": report.get("error"),
            }
        )
    )
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
