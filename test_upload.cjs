const fs = require('fs');
const http = require('http');

const FormData = require('form-data');
const form = new FormData();
form.append('file', fs.createReadStream('package.json'));

const request = http.request({
  method: 'post',
  host: 'localhost',
  port: 3000,
  path: '/api/upload',
  headers: form.getHeaders(),
});

form.pipe(request);

request.on('response', function(res) {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => console.log(res.statusCode, body));
});
