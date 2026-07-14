import { askDeepSeek, parseJsonResponse } from '../services/deepseek.js';

export const translateSystemPrompt = `你是一个英语生活助理。用户会发给你一个英文句子或词，请返回以下三项，用 JSON 格式输出，不要有多余文字：
{
  "translation": "中文翻译",
  "scene": "一句话说明这个表达在什么场景用（口语化）",
  "better": "更地道的替换表达，如果没有则返回空字符串"
}`;

export async function translateSource(source) {
  const text = await askDeepSeek([
    { role: 'system', content: translateSystemPrompt },
    { role: 'user', content: source },
  ]);
  const result = parseJsonResponse(text);
  return {
    source,
    translation: result.translation || '',
    scene: result.scene || '',
    better: result.better || '',
  };
}
