const fs = require('fs');

function main() {
  if (!fs.existsSync('comments_translated.json')) {
    console.error("No translation file found.");
    return;
  }
  const data = JSON.parse(fs.readFileSync('comments_translated.json', 'utf8'));
  
  for (const filePath of Object.keys(data)) {
    if (!fs.existsSync(filePath)) continue;
    
    let content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const translatedLines = data[filePath];
    
    for (const tl of translatedLines) {
      if (tl.lineIndex >= 0 && tl.lineIndex < lines.length) {
        lines[tl.lineIndex] = tl.text;
      }
    }
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
  }
  console.log("Applied translated comments to " + Object.keys(data).length + " files.");
}

main();
