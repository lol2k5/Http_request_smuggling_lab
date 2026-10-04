#!/usr/bin/env python3
import os
import fcntl
from fastapi import FastAPI, Request, Response

app = FastAPI()
COUNTER_FILE = "/tmp/admin_counter.txt"

# Khởi tạo file nếu chưa có
if not os.path.exists(COUNTER_FILE):
    with open(COUNTER_FILE, "w") as f:
        f.write("0")

def increment_counter():
    with open(COUNTER_FILE, "r+") as f:
        fcntl.flock(f, fcntl.LOCK_EX)
        val = int(f.read().strip() or 0) + 1
        f.seek(0)
        f.write(str(val))
        f.truncate()
        fcntl.flock(f, fcntl.LOCK_UN)
    return val

def read_counter():
    if not os.path.exists(COUNTER_FILE):
        return "0"
    with open(COUNTER_FILE, "r") as f:
        return f.read().strip()

@app.api_route('/', methods=['GET', 'POST'])
async def normal(request: Request):
    body = await request.body()
    return Response(content=body, media_type="text/plain")

@app.api_route('/admin', methods=['GET', 'POST'])
async def admin():
    increment_counter()
    return Response(content="This support to be hidden", media_type="text/plain")

@app.get('/count')
async def get_count():
    return Response(content=f"Admin visits: {read_counter()}\n", media_type="text/plain")