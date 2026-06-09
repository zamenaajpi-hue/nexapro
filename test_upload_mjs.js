import fs from 'fs';

const blob = new Blob([fs.readFileSync('package.json')], { type: 'application/json' });
const formData = new FormData();
formData.append('file', blob, 'package.json');

fetch('http://localhost:3000/api/upload', {
  method: 'POST',
  body: formData
}).then(res => res.text()).then(console.log).catch(console.error);
