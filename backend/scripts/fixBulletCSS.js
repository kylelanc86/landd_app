const fs = require('fs');
const path = require('path');

const pdfFile = path.join(__dirname, '../routes/pdf.js');

// Read the file
let content = fs.readFileSync(pdfFile, 'utf8');

// Fix the first .bullets CSS definition
// Remove list-style-position: inside from .bullets rule
content = content.replace(
  /\.bullets \{\s+margin: 0 0 8px 16px;\s+padding-left: 20px;\s+font-size: 0\.8rem;\s+color: #222;\s+line-height: 1\.5;\s+text-align: justify;\s+list-style-position: inside;\s+\}/,
  `.bullets {
        margin: 0 0 8px 16px;
        padding: 0;
        font-size: 0.8rem;
        color: #222;
        line-height: 1.5;
        text-align: justify;
      }`
);

// Fix the first .bullets li CSS definition
content = content.replace(
  /\.bullets li \{\s+margin-bottom: 4px;\s+list-style-type: disc;\s+list-style-position: inside;\s+font-size: 0\.8rem;\s+line-height: 1\.5;\s+text-align: justify;\s+padding-left: 0;\s+text-indent: 0;\s+\}/,
  `.bullets li {
        margin-bottom: 4px;
        list-style-type: none;
        position: relative;
        padding-left: 20px;
        font-size: 0.8rem;
        line-height: 1.5;
        text-align: justify;
      }`
);

// Fix the first .bullets li::marker to .bullets li::before with better sizing and centering
content = content.replace(
  /\.bullets li::marker \{\s+font-size: 1\.2em;\s+color: #222;\s+\}/,
  `.bullets li::before {
      content: "•";
      position: absolute;
      left: 0;
      top: 50%;
      transform: translateY(-50%);
      font-size: 1.3em;      /* Try 1.3em or 1.4em for a larger bullet */
      color: #222;
      line-height: 1;
  }`
);

// Also fix the second .bullets li::before definition
content = content.replace(
    /\.bullets li::before \{\s+content: "•";\s+position: absolute;\s+left: 0;\s+top: 0;\s+font-size: 1\.2em;\s+color: #222;\s+\}/g,
    `.bullets li::before {
        content: "•";
        position: absolute;
        left: 0;
        top: 50%;
        transform: translateY(-50%);
        font-size: 1.3em;      /* Try 1.3em or 1.4em for a larger bullet */
        color: #222;
        line-height: 1;
    }`
);

// Write the file back
fs.writeFileSync(pdfFile, content, 'utf8');

console.log('✅ Bullet point CSS has been fixed!');
console.log('Bullets are now larger (1.5em) and properly centered.'); 