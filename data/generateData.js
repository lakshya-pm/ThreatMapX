const fs = require('fs');
const path = require('path');

// Realistic global coordinates
const regions = [
  { name: 'China', lat: 35.8617, lng: 104.1954, ips: ['114.114.114.114', '223.5.5.5'] },
  { name: 'United States', lat: 37.0902, lng: -95.7129, ips: ['8.8.8.8', '1.1.1.1'] },
  { name: 'Russia', lat: 61.524, lng: 105.3188, ips: ['77.88.8.8', '93.158.134.3'] },
  { name: 'Brazil', lat: -14.235, lng: -51.9253, ips: ['177.192.0.0', '189.16.0.0'] },
  { name: 'India', lat: 20.5937, lng: 78.9629, ips: ['49.207.0.0', '106.193.0.0'] },
  { name: 'Germany', lat: 51.1657, lng: 10.4515, ips: ['85.214.0.0', '88.130.0.0'] },
  { name: 'Japan', lat: 36.2048, lng: 138.2529, ips: ['122.1.0.0', '133.0.0.0'] },
  { name: 'United Kingdom', lat: 55.3781, lng: -3.436, ips: ['81.130.0.0', '82.11.0.0'] },
];

const attackTypes = ['SYN', 'UDP', 'HTTP'];

function randomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomFloat(min, max) {
  return Math.random() * (max - min) + min;
}

function generateAttacks(count) {
  const attacks = [];
  const now = Date.now();
  
  for (let i = 0; i < count; i++) {
    const src = randomElement(regions);
    let dst = randomElement(regions);
    while (dst.name === src.name) {
      dst = randomElement(regions);
    }

    const type = randomElement(attackTypes);
    const intensity = randomFloat(0.1, 1.0);
    const pps = Math.floor(randomFloat(1000, 50000));
    
    // Spread timestamps over the last 10 minutes (600,000 ms)
    const timestamp = new Date(now - Math.random() * 600000).toISOString();
    
    // Jitter coordinates slightly so they don't pile up perfectly
    const srcLat = src.lat + randomFloat(-5, 5);
    const srcLng = src.lng + randomFloat(-5, 5);
    const dstLat = dst.lat + randomFloat(-5, 5);
    const dstLng = dst.lng + randomFloat(-5, 5);

    attacks.push({
      id: `atk_${i}_${Date.now().toString(36)}`,
      timestamp,
      srcLat,
      srcLng,
      dstLat,
      dstLng,
      srcCountry: src.name,
      dstCountry: dst.name,
      srcIp: randomElement(src.ips),
      dstIp: randomElement(dst.ips),
      attackType: type,
      intensity,
      packetsPerSec: pps
    });
  }
  
  // Sort chronologically
  attacks.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  return attacks;
}

const dataFile = path.join(__dirname, 'attacks.json');
const attacks = generateAttacks(300);

fs.writeFileSync(dataFile, JSON.stringify(attacks, null, 2));
console.log(`Generated ${attacks.length} events in ${dataFile}`);
