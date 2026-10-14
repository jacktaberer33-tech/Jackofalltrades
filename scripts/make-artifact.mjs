// Turns the single-file artifact build into a page fragment: the artifact host adds its own
// <!doctype>, <html>, <head> and <body>, charset and viewport, so we keep only the contents,
// with <title> first.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const html = readFileSync('dist-artifact/index.html', 'utf8');
const head = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? '';
const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? '';

let headInner = head
  .replace(/<meta[^>]*charset[^>]*>/i, '')
  .replace(/<meta[^>]*name="viewport"[^>]*>/i, '');
const title = headInner.match(/<title>[\s\S]*?<\/title>/i)?.[0] ?? '<title>Jack of All Trades</title>';
headInner = headInner.replace(title, '');

mkdirSync('artifact', { recursive: true });
writeFileSync('artifact/jack-of-all-trades.html', `${title}\n${headInner.trim()}\n${body.trim()}\n`);
console.log('Wrote artifact/jack-of-all-trades.html');
