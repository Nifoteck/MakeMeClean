import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';

const images: Record<string, string> = {
  // Hero and General
  'home-hero-before.jpg': 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=1200&auto=format&fit=crop&q=85',
  'home-hero-after.jpg': 'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?w=1200&auto=format&fit=crop&q=85',
  
  // Services
  'service-standard-clean.jpg': 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800&auto=format&fit=crop&q=85',
  'service-regular-cleaning.jpg': 'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?w=800&auto=format&fit=crop&q=85',
  'service-one-off-cleaning.jpg': 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=800&auto=format&fit=crop&q=85',
  'service-deep-cleaning.jpg': 'https://images.unsplash.com/photo-1585421514738-01798e348b17?w=800&auto=format&fit=crop&q=85',
  'service-spring-cleaning.jpg': 'https://images.unsplash.com/photo-1563453392212-326f5e854473?w=800&auto=format&fit=crop&q=85',
  'service-same-day-cleaning.jpg': 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800&auto=format&fit=crop&q=85',
  'service-airbnb-cleaning.jpg': 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&auto=format&fit=crop&q=85',
  'service-ironing-service.jpg': 'https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?w=800&auto=format&fit=crop&q=85',
  'service-cleaning-and-ironing.jpg': 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800&auto=format&fit=crop&q=85',
  'service-housekeeping.jpg': 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&auto=format&fit=crop&q=85',
  'service-office-cleaning.jpg': 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&auto=format&fit=crop&q=85',

  // Blog Posts
  'blog-prepare-home.jpg': 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=1000&auto=format&fit=crop&q=85',
  'blog-eco-friendly.jpg': 'https://images.unsplash.com/photo-1563453392212-326f5e854473?w=1000&auto=format&fit=crop&q=85',
  'blog-spring-cleaning.jpg': 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=1000&auto=format&fit=crop&q=85',
  'blog-recurring-cleaning.jpg': 'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?w=1000&auto=format&fit=crop&q=85',
  'blog-deep-clean.jpg': 'https://images.unsplash.com/photo-1585421514738-01798e348b17?w=1000&auto=format&fit=crop&q=85',
  'blog-airbnb.jpg': 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1000&auto=format&fit=crop&q=85',
};

const publicImagesDir = path.resolve(process.cwd(), 'public', 'images');

if (!fs.existsSync(publicImagesDir)) {
  fs.mkdirSync(publicImagesDir, { recursive: true });
}

function download(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to download ${url}: status ${res.statusCode}`));
      }
      const fileStream = fs.createWriteStream(dest);
      res.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });
      fileStream.on('error', reject);
    }).on('error', reject);
  });
}

async function run() {
  console.log('Downloading high quality, copyright-free authentic photography from Unsplash...');
  for (const [filename, url] of Object.entries(images)) {
    const dest = path.join(publicImagesDir, filename);
    process.stdout.write(`Downloading ${filename}... `);
    try {
      await download(url, dest);
      console.log('✓ Done');
    } catch (err) {
      console.log('✗ Error:', err);
    }
  }
  console.log('All real photography assets successfully updated!');
}

run();

