import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const files = [
  'index.html', 'laptop.html', 'mobile.html', 'auth.js', 'app-config.js', 'runtime-config.js',
  'v105.js', 'v105.css', 'v106.js', 'v106.css', 'v108.js', 'v108.css', 'v1082.js', 'v1082.css',
  'v109.js', 'v109.css', 'v110.js', 'v110.css', 'v111.js', 'v111.css', 'visit-pdf.js',
  'vendor/jspdf.umd.min.js', 'vendor/jspdf-LICENSE.txt',
  'logo.png', 'logo-dark.png', 'logo-dark-menu.png', 'logo-header.png',
  'logo-light.png', 'logo-login.png', 'logo-menu.png'
];
const dist = resolve('dist');
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
for (const file of files) {
  await mkdir(dirname(resolve(dist, file)), { recursive: true });
  await cp(resolve(file), resolve(dist, file));
}
console.log('Deploymentmap gemaakt:', dist);
