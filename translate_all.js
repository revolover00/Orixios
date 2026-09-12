const fs = require('fs');

const apiKey = process.env.GEMINI_API_KEY;

async function main() {
  const data = JSON.parse(fs.readFileSync('comments.json', 'utf8'));
  const prompt = `
You are an expert translator. I have a JSON object mapping file paths to an array of objects. 
Each object has a "lineIndex" and "text" representing a line of code containing an Arabic comment.
Translate the Arabic part of the comment in "text" to English. Keep all code formatting, spaces, and code characters (like //, /*, */) exactly as they are. Do NOT change any code, just the natural language comment.
Output the result in the exact same JSON format: { "filePath": [ { "lineIndex": number, "text": "translated string" } ] }.
Output ONLY valid JSON, no markdown blocks.

JSON:
${JSON.stringify(data, null, 2)}
`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: "Output ONLY raw JSON. No markdown." }] },
        generationConfig: { temperature: 0.1 }
      })
    });
    const resData = await response.json();
    let text = resData.candidates[0].content.parts[0].text;
    text = text.replace(/^```json\n/, '').replace(/^```\n/, '').replace(/\n```$/, '');
    fs.writeFileSync('comments_translated.json', text, 'utf8');
    console.log('Translated successfully!');
  } catch (e) {
    console.error(e);
  }
}

main();
