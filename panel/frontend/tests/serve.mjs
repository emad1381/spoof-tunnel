import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve('out');
http.createServer((req, res) => {
 const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/reviewprefix/, '');
 let file = path.resolve(root, '.' + pathname);
 if (!file.startsWith(root + path.sep) && file !== root) { res.writeHead(403).end(); return; }
 if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
 if (!fs.existsSync(file)) { res.writeHead(404).end(); return; }
 res.setHeader('Content-Type', file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : 'application/octet-stream');
 res.end(fs.readFileSync(file));
}).listen(18765, '127.0.0.1');
