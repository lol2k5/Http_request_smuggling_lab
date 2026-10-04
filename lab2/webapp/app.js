const http = require('http');
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();

// ─── Chuẩn bị thư mục data ──────────────────────────────────
const DATA_DIR = path.join(__dirname, 'data');
const COMMENTS_FILE = path.join(DATA_DIR, 'comments.json');
const ACCESS_LOG = path.join(DATA_DIR, 'access.log');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(COMMENTS_FILE)) fs.writeFileSync(COMMENTS_FILE, '[]');
if (!fs.existsSync(ACCESS_LOG)) fs.writeFileSync(ACCESS_LOG, '');

// ─── "Database" bài viết (giả lập) ─────────────────────────
const POSTS = {
    1: {
        title: 'Welcome to SecBlog',
        author: 'admin',
        date: '2026-01-15',
        body: `Chào mừng bạn đến với SecBlog — nơi chia sẻ kiến thức về bảo mật web, pentest và bug bounty. Hãy đọc các bài viết và để lại bình luận bên dưới nhé.`
    },
    2: {
        title: 'Understanding HTTP Request Smuggling',
        author: 'sec-team',
        date: '2026-02-20',
        body: `HTTP request smuggling là kỹ thuật can thiệp vào cách một website xử lý chuỗi HTTP request từ nhiều người dùng. Nó khai thác sự khác biệt trong cách front-end và back-end server parse HTTP request.`
    },
    3: {
        title: 'XSS — Lỗ hổng vĩnh cửu',
        author: 'admin',
        date: '2026-03-10',
        body: `Cross-site scripting (XSS) vẫn là một trong những lỗ hổng phổ biến nhất. Bất chấp nhiều năm cảnh báo, nó vẫn xuất hiện trong các ứng dụng hiện đại do ngữ cảnh render phức tạp và sự bất cẩn của lập trình viên.`
    }
};

// ─── Middleware ghi access log (lưu User-Agent vào file) ───
app.use((req, res, next) => {
    const ua = req.headers['user-agent'] || '-';
    const line = `[${new Date().toISOString()}] ${req.ip} "${req.method} ${req.originalUrl}" UA="${ua}"\n`;
    try { fs.appendFileSync(ACCESS_LOG, line); } catch (e) {}
    next();
});

// ─── Static assets ──────────────────────────────────────────
app.use('/static', express.static(path.join(__dirname, 'public')));

// ─── Layout helper ──────────────────────────────────────────
function layout(title, content) {
    return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} — SecBlog</title>
<link rel="stylesheet" href="/static/style.css">
</head>
<body>
<header>
    <div class="container">
        <a href="/" class="logo">🔒 SecBlog</a>
        <nav>
            <a href="/">Home</a>
            <a href="/post/1">Welcome</a>
            <a href="/post/2">Smuggling</a>
            <a href="/post/3">XSS</a>
            <a href="/logs">Logs</a>
        </nav>
    </div>
</header>
<main class="container">
${content}
</main>
<footer>
    <div class="container">© 2026 SecBlog — Demo lab environment</div>
</footer>
</body>
</html>`;
}

// ─── Trang chủ ──────────────────────────────────────────────
app.get('/', (req, res) => {
    let cards = '';
    for (const id of Object.keys(POSTS)) {
        const p = POSTS[id];
        cards += `<article class="card">
            <h2><a href="/post/${id}">${p.title}</a></h2>
            <div class="meta">bởi ${p.author} · ${p.date}</div>
            <p>${p.body.slice(0, 140)}...</p>
            <a class="btn" href="/post/${id}">Đọc tiếp →</a>
        </article>`;
    }
    res.send(layout('Home', `<h1 class="page-title">Bài viết mới nhất</h1>${cards}`));
});

// ─── Trang bài viết + form comment (ĐIỂM XSS) ──────────────
app.get('/post/:id', (req, res) => {
    const post = POSTS[req.params.id];
    if (!post) {
        return res.status(404).send(layout('Not Found', '<h1>404 — Không tìm thấy bài viết</h1>'));
    }

    const userAgent = req.headers['user-agent'] || '';

    let comments = [];
    try { comments = JSON.parse(fs.readFileSync(COMMENTS_FILE, 'utf8')); } catch (e) {}
    const postComments = comments.filter(c => String(c.postId) === String(req.params.id));

    let commentsHtml = '';
    if (postComments.length === 0) {
        commentsHtml = `<p class="muted">Chưa có bình luận nào. Hãy là người đầu tiên!</p>`;
    } else {
        for (const c of postComments) {
            // ⚠️ Cố tình KHÔNG escape — đây là lỗ hổng cần giữ
            commentsHtml += `<div class="comment">
                <div class="comment-meta"><strong>Anonymous</strong> · ${new Date(c.timestamp).toLocaleString('vi-VN')}</div>
                <div class="comment-body">${c.comment}</div>
            </div>`;
        }
    }

    const html = `
        <article class="post">
            <h1>${post.title}</h1>
            <div class="meta">bởi ${post.author} · ${post.date}</div>
            <div class="post-body">${post.body}</div>
        </article>

        <section class="comments">
            <h2>Bình luận (${postComments.length})</h2>
            ${commentsHtml}
        </section>

        <section class="comment-form">
            <h2>Để lại bình luận</h2>
            <form method="POST" action="/post/${req.params.id}/comment">
                <!-- ⚠️ SINK XSS: User-Agent reflect KHÔNG escape vào value -->
                <input type="hidden" name="userAgent" value="${userAgent}">
                <label for="comment">Bình luận của bạn</label>
                <textarea id="comment" name="comment" rows="5" placeholder="Viết bình luận..."></textarea>
                <button type="submit" class="btn">Gửi bình luận</button>
            </form>
        </section>
    `;
    res.send(layout(post.title, html));
});

// ─── Nhận comment, lưu vào file JSON ────────────────────────
app.post('/post/:id/comment', express.urlencoded({ extended: true }), (req, res) => {
    const post = POSTS[req.params.id];
    if (!post) return res.status(404).send('Post not found');

    let comments = [];
    try { comments = JSON.parse(fs.readFileSync(COMMENTS_FILE, 'utf8')); } catch (e) {}

    comments.push({
        postId: req.params.id,
        userAgent: req.body.userAgent || '',
        comment: req.body.comment || '',
        timestamp: Date.now()
    });

    fs.writeFileSync(COMMENTS_FILE, JSON.stringify(comments, null, 2));
    res.redirect(`/post/${req.params.id}`);
});

// ─── Trang xem log (tiện debug, giống admin panel) ─────────
app.get('/logs', (req, res) => {
    let logContent = '';
    try { logContent = fs.readFileSync(ACCESS_LOG, 'utf8'); } catch (e) {}
    // Escape để tránh tạo thêm 1 sink XSS nữa
    const escaped = logContent
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    res.send(layout('Logs', `
        <h1 class="page-title">Access Logs</h1>
        <p class="muted">File: <code>data/access.log</code></p>
        <pre class="logs">${escaped || '(empty)'}</pre>
    `));
});

// ─── HTTP server với insecure parser ────────────────────────
const server = http.createServer({ insecureHTTPParser: true }, app);
server.keepAliveTimeout = 60000;
server.headersTimeout = 60000;
server.requestTimeout = 0;

server.listen(9006, '0.0.0.0', () => {
    console.log('[Backend] Listening on 0.0.0.0:9006');
});