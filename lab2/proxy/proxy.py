import socket
import threading

BACKEND_HOST = "webapp"
BACKEND_PORT = 9006

backend_socket = None
lock = threading.Lock()

def get_backend():
    global backend_socket
    if backend_socket is None:
        try:
            backend_socket = socket.create_connection((BACKEND_HOST, BACKEND_PORT))
            backend_socket.settimeout(10)
        except Exception as e:
            print(f"[Proxy] Không thể kết nối Backend: {e}", flush=True)
            return None
    return backend_socket

def close_backend():
    global backend_socket
    if backend_socket:
        try: backend_socket.close()
        except: pass
        backend_socket = None
        print("[Proxy] Đã reset kết nối Backend", flush=True)

def read_one_request(sock):
    """Đọc 1 request dựa trên Content-Length"""
    request = b""
    sock.settimeout(10)
    while True:
        try:
            data = sock.recv(4096)
        except socket.timeout:
            return None
        if not data:
            return None
        request += data
        if b"\r\n\r\n" in request:
            header_end = request.find(b"\r\n\r\n")
            headers = request[:header_end].decode('latin-1', errors='ignore')
            cl = 0
            for line in headers.split('\r\n'):
                if line.lower().startswith('content-length:'):
                    cl = int(line.split(':')[1].strip())
                    break
            if len(request) >= header_end + 4 + cl:
                return request[:header_end + 4 + cl]

def read_one_response(sock):
    """Đọc 1 response dựa trên Content-Length"""
    response = b""
    sock.settimeout(10)
    while True:
        try:
            data = sock.recv(4096)
        except socket.timeout:
            return None
        if not data:
            return None
        response += data
        if b"\r\n\r\n" in response:
            header_end = response.find(b"\r\n\r\n")
            headers = response[:header_end].decode('latin-1', errors='ignore')
            cl = 0
            for line in headers.split('\r\n'):
                if line.lower().startswith('content-length:'):
                    cl = int(line.split(':')[1].strip())
                    break
            if len(response) >= header_end + 4 + cl:
                return response

def handle_client(client_socket):
    try:
        # ⭐ Vòng lặp để browser load được CSS, favicon... trên cùng connection
        while True:
            request = read_one_request(client_socket)
            if not request:
                break

            print(f"[Proxy] Nhận {len(request)} bytes từ Burp", flush=True)

            with lock:
                backend = get_backend()
                if not backend:
                    break

                try:
                    backend.sendall(request)
                    print(f"[Proxy] Đã gửi tới Backend. Đang chờ response...", flush=True)

                    response = read_one_response(backend)
                    if response is None:
                        print(f"[Proxy] Backend đóng kết nối", flush=True)
                        close_backend()
                        break

                    # ⭐ Ép Connection: close để browser không tái sử dụng connection
                    response = response.replace(
                        b"Connection: keep-alive", b"Connection: close"
                    ).replace(
                        b"connection: keep-alive", b"Connection: close"
                    )

                    print(f"[Proxy] Nhận {len(response)} bytes từ Backend", flush=True)
                    client_socket.sendall(response)

                    # Response yêu cầu close → đóng luôn connection của client
                    if b"Connection: close" in response[:300]:
                        break

                except Exception as e:
                    print(f"[Proxy Error] {e}", flush=True)
                    close_backend()
                    break
    finally:
        client_socket.close()

def main():
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind(("0.0.0.0", 9005))
    server.listen(5)
    print("[Proxy] Đang lắng nghe trên 0.0.0.0:9005", flush=True)
    while True:
        client, addr = server.accept()
        threading.Thread(target=handle_client, args=(client,)).start()

if __name__ == "__main__":
    main()