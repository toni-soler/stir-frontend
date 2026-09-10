import fs from 'node:fs';
const bundles=JSON.parse(fs.readFileSync('src/locales.json','utf8'));
const locales=['es','en','ca','de','fr','it','pt','jp','eu','gl','pt-BR','zh'];
const keys=Object.keys(bundles.en).sort();
for(const locale of locales){if(JSON.stringify(Object.keys(bundles[locale]||{}).sort())!==JSON.stringify(keys))throw new Error(`Missing translations: ${locale}`);if(Object.values(bundles[locale]).some(v=>typeof v!=='string'||!v.trim()))throw new Error(`Empty translation: ${locale}`);}
console.log(`PASS: ${locales.length} locales, ${keys.length} keys each`);
