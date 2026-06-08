/**
 * Utility to generate highly modern, distinctive, and unique geometric avatars
 * for chat groups or users based on their names.
 * Using sophisticated math and harmonious palette structures to ensure
 * high aesthetic quality, premium styling, and absolute variance.
 */

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

function encodeBase64(str: string): string {
  try {
    if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
      return 'data:image/svg+xml;base64,' + window.btoa(unescape(encodeURIComponent(str)));
    }
  } catch (e) {
    // Ignore and fallback to Buffer or direct uri-encode
  }
  
  try {
    if (typeof Buffer !== 'undefined') {
      return 'data:image/svg+xml;base64,' + Buffer.from(str).toString('base64');
    }
  } catch (e) {
    // Fallback to direct url-encode
  }
  
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(str);
}

/**
 * Generates an SVG geometric pattern as a base64 Data URI
 * based deterministically on the provided name.
 */
export function generateGroupAvatar(groupName: string): string {
  const name = (groupName || 'Group').trim() || 'Group';
  const hash = hashString(name);
  
  // Decide which of the 5 gorgeous modern layout styles to render
  const layoutStyle = hash % 5;
  
  // Generate beautiful HSL palette based on hash
  const h1 = hash % 360;
  const s1 = 65 + (hash % 15); // 65% to 80%
  const l1 = 40 + (hash % 12); // 40% to 52%
  
  const h2 = (h1 + 80 + (hash % 100)) % 360;
  const s2 = 70 + (hash % 15);
  const l2 = 35 + (hash % 12);
  
  const hAccent = (h1 + 180) % 360; // Polar opposite accent
  const sAccent = 80 + (hash % 15);
  const lAccent = 50 + (hash % 10);
  
  const color1 = `hsl(${h1}, ${s1}%, ${l1}%)`;
  const color2 = `hsl(${h2}, ${s2}%, ${l2}%)`;
  const colorAccent = `hsl(${hAccent}, ${sAccent}%, ${lAccent}%)`;
  
  // Create rich dark or semi-vibrant backdrop for premium contrast
  const hBg = (h1 + 150) % 360;
  const sBg = 25 + (hash % 15);
  const lBg = 12 + (hash % 8); // Deep luxury dark shade
  const bgColor = `hsl(${hBg}, ${sBg}%, ${lBg}%)`;
  
  let shapesSvg = '';
  
  switch (layoutStyle) {
    case 0: {
      // Overlapping Circles & Translucent Focus Ring (Bauhaus Ambient)
      const r1 = 45 + (hash % 15);
      const r2 = 35 + (hash % 10);
      const rAccent = 22 + (hash % 8);
      shapesSvg = `
        <rect width="200" height="200" fill="${bgColor}" rx="48" />
        <circle cx="100" cy="100" r="85" fill="none" stroke="${color1}" stroke-width="4" opacity="0.12" />
        <circle cx="72" cy="72" r="${r1}" fill="${color1}" opacity="0.75" />
        <circle cx="128" cy="128" r="${r2}" fill="${color2}" opacity="0.8" style="mix-blend-mode: screen;" />
        <circle cx="100" cy="100" r="${rAccent}" fill="${colorAccent}" />
        <circle cx="100" cy="100" r="${rAccent / 2}" fill="${bgColor}" />
      `;
      break;
    }
    case 1: {
      // Modern Quadrant Swiss Geometry (Intersecting squares, circles, lines)
      shapesSvg = `
        <rect width="200" height="200" fill="${bgColor}" rx="48" />
        <g opacity="0.9">
          <rect x="25" y="25" width="70" height="150" rx="16" fill="${color1}" opacity="0.7" />
          <rect x="105" y="25" width="70" height="70" rx="35" fill="${colorAccent}" />
          <rect x="105" y="105" width="70" height="70" rx="16" fill="${color2}" opacity="0.8" />
          <circle cx="60" cy="100" r="18" fill="${bgColor}" />
          <line x1="25" y1="100" x2="175" y2="100" stroke="${colorAccent}" stroke-width="4" opacity="0.5" stroke-dasharray="8 8" />
        </g>
      `;
      break;
    }
    case 2: {
      // Concentric Radiating Rings, Grid and Polygons (Isometric Techno)
      const radius = 25 + (hash % 15);
      shapesSvg = `
        <rect width="200" height="200" fill="${bgColor}" rx="48" />
        <g opacity="0.85">
          <circle cx="100" cy="100" r="80" fill="none" stroke="${color1}" stroke-width="3" stroke-dasharray="14 8" />
          <circle cx="100" cy="100" r="55" fill="none" stroke="${color2}" stroke-width="10" opacity="0.4" />
          <circle cx="100" cy="100" r="${radius}" fill="${colorAccent}" />
          <polygon points="100,10 115,75 190,100 115,125 100,190 85,125 10,100 85,75" fill="${color1}" opacity="0.65" style="mix-blend-mode: color-dodge;" />
          <circle cx="100" cy="100" r="10" fill="${bgColor}" />
        </g>
      `;
      break;
    }
    case 3: {
      // Modernist Abstract Triangular Canopy / Horizon Prism
      const baseline = 155;
      shapesSvg = `
        <rect width="200" height="200" fill="${bgColor}" rx="48" />
        <g opacity="0.9">
          <polygon points="40,${baseline} 100,35 160,${baseline}" fill="${color2}" opacity="0.75" />
          <polygon points="15,${baseline} 80,65 145,${baseline}" fill="${color1}" opacity="0.6" style="mix-blend-mode: screen;" />
          <circle cx="100" cy="85" r="24" fill="${colorAccent}" />
          <circle cx="100" cy="85" r="12" fill="${bgColor}" />
          <line x1="20" y1="${baseline}" x2="180" y2="${baseline}" stroke="${colorAccent}" stroke-width="6" stroke-linecap="round" />
        </g>
      `;
      break;
    }
    case 4: {
      // Retro Future Synthesis Wave (Offset Semicircles and Beams)
      shapesSvg = `
        <rect width="200" height="200" fill="${bgColor}" rx="48" />
        <g opacity="0.9">
          <!-- Horizon Grid Lines -->
          <line x1="10" y1="130" x2="190" y2="130" stroke="${color1}" stroke-width="2" opacity="0.4" />
          <line x1="10" y1="145" x2="190" y2="145" stroke="${color1}" stroke-width="3" opacity="0.5" />
          <line x1="10" y1="160" x2="190" y2="160" stroke="${color1}" stroke-width="4" opacity="0.6" />
          
          <!-- Sun Semicircle -->
          <path d="M 50,110 A 50,50 0 0,1 150,110 Z" fill="${colorAccent}" opacity="0.85" />
          
          <!-- Abstract Diagonal Pillars -->
          <rect x="40" y="40" width="20" height="120" rx="10" transform="rotate(30 40 40)" fill="${color1}" opacity="0.7" style="mix-blend-mode: screen;" />
          <rect x="140" y="-30" width="20" height="120" rx="10" transform="rotate(30 140 -30)" fill="${color2}" opacity="0.8" style="mix-blend-mode: screen;" />
          
          <!-- Glowing center point -->
          <circle cx="100" cy="110" r="15" fill="${color2}" />
        </g>
      `;
      break;
    }
  }
  
  const outerSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">${shapesSvg}</svg>`;
  return encodeBase64(outerSvg);
}
