const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';

export async function askDeepSeek(messages) {
  const response = await fetch(DEEPSEEK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages,
    }),
  });

  if (!response.ok) {
    throw new Error('DeepSeek API request failed');
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

export function parseJsonResponse(text) {
  const cleanText = text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  return JSON.parse(cleanText);
}
