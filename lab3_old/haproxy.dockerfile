FROM haproxy:1.9.10
EXPOSE 443

# Copy chứng chỉ vào container
COPY haproxy.pem /usr/local/etc/haproxy/haproxy.pem

RUN echo 'defaults\n\
    mode http\n\
    option http-use-htx\n\
    timeout http-keep-alive 10s\n\
    timeout connect 5s\n\
    timeout server 60s\n\
    timeout client 30s\n\
    timeout http-request 30s\n\
\n\
backend web\n\
    http-reuse always\n\
    server web0 fastapi:6767\n\
\n\
frontend https\n\
    bind *:443 ssl crt /usr/local/etc/haproxy/haproxy.pem alpn h2,http/1.1\n\
    timeout client 5s\n\
    timeout http-request 10s\n\
    acl is_admin path_beg -i /admin\n\
    http-request deny deny_status 403 if is_admin\n\
    default_backend web\n\
\n\
\n'> /usr/local/etc/haproxy/haproxy.cfg

CMD ["haproxy", "-f", "/usr/local/etc/haproxy/haproxy.cfg"]