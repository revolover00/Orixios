const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const apiKey = process.env.GEMINI_API_KEY;

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

async function translateFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  // Check if it has arabic comments (rough regex)
  if (!/(?:\/\/|\/\*|\*).*[\u0600-\u06FF]/.test(content)) {
    return;
  }
  
  const prompt = `
You are an expert developer.
Below is a TypeScript/TSX file.
Translate ALL internal code comments (//, /* */, /** */) from Arabic to English.
DO NOT change ANY user-facing text, JSX text, strings, UI text, or error messages (keep them in Arabic).
DO NOT change the code logic or variable names.
Output ONLY the raw file content with the translated comments, without markdown formatting or code blocks.

FILE CONTENT:
${content}
`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: "Output only the raw code. No markdown formatting. No explanation." }] },
        generationConfig: { temperature: 0.1 }
      })
    });
    const data = await response.json();
    let newContent = data.candidates[0].content.parts[0].text;
    
    // cleanup markdown if added by mistake
    newContent = newContent.replace(/^```[a-z]*\n/, '').replace(/\n```$/, '');
    
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`Translated: ${filePath}`);
  } catch (err) {
    console.error(`Failed to translate: ${filePath}`, err);
  }
}

async function main() {
  const files = findFiles('src');
  const batchSize = 5;
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    await Promise.all(batch.map(f => translateFile(f)));
  }
}

main();
