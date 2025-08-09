const http = require('http');
const path = require('path');
const fs = require('fs');

const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT) || 8080;
const ROOT = __dirname;

const mimeTypes = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'text/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif'
};

function sendFile(res, filePath){
  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, data) => {
    if(err){
      res.writeHead(err.code === 'ENOENT' ? 404 : 500, { 'Content-Type': 'text/plain; charset=UTF-8' });
      res.end(err.code === 'ENOENT' ? '404 Not Found' : '500 Internal Server Error');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  let safePath = urlPath;
  if(safePath === '/' || safePath === '') safePath = '/index.html';

  const resolved = path.join(ROOT, safePath);

  // Prevent directory traversal
  if(!resolved.startsWith(ROOT)){
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=UTF-8' });
    res.end('Forbidden');
    return;
  }

  fs.stat(resolved, (err, stat) => {
    if(err){
      // Fallback to index.html for unknown routes
      sendFile(res, path.join(ROOT, 'index.html'));
      return;
    }
    if(stat.isDirectory()){
      sendFile(res, path.join(resolved, 'index.html'));
      return;
    }
    sendFile(res, resolved);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`IP Locator running at http://${HOST}:${PORT}`);
});


