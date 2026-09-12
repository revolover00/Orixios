const fs = require('fs');
const path = require('path');

function findFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(findFiles(file));
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      results.push(file);
    }
  });
  return results;
}

const files = findFiles('src');
const commentsToTranslate = {};
let id = 0;

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  const fileComments = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/(?:\/\/|\/\*|\*).*[\u0600-\u06FF]/.test(line)) {
      fileComments.push({ lineIndex: i, text: line });
    }
  }
  
  if (fileComments.length > 0) {
    commentsToTranslate[file] = fileComments;
  }
});

fs.writeFileSync('comments.json', JSON.stringify(commentsToTranslate, null, 2));
console.log(`Extracted comments from ${Object.keys(commentsToTranslate).length} files.`);
