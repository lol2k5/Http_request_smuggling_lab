#!/usr/bin/python
import os
import fcntl
from flask import Flask, request

app = Flask(__name__)
COUNTER_FILE = "/tmp/admin_counter.txt"

# Khởi tạo file nếu chưa có
if not os.path.exists(COUNTER_FILE):
    with open(COUNTER_FILE, "w") as f:
        f.write("0")

def increment_counter():
    with open(COUNTER_FILE, "r+") as f:
        fcntl.flock(f, fcntl.LOCK_EX)  # Khóa file để tránh race condition giữa các process
        val = int(f.read().strip() or 0) + 1
        f.seek(0)
        f.write(str(val))
        f.truncate()
        fcntl.flock(f, fcntl.LOCK_UN)
    return val

def read_counter():
    if not os.path.exists(COUNTER_FILE):
        return 0
    with open(COUNTER_FILE, "r") as f:
        return f.read().strip()

@app.route('/', methods=['GET', 'POST'])
def normal():
    return request.get_data()

@app.route('/admin', methods=['GET', 'POST'])
def admin():
    increment_counter()
    return 'This should to be hidden'

@app.route('/count', methods=['GET'])
def get_count():
    return f"Admin visits: {read_counter()}\n"

if __name__ == '__main__':
    app.debug = False
    app.run()