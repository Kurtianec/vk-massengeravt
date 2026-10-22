// Public RSS headlines are unverified context, never a stand-alone trading signal.
const unescape=s=>s.replace(/<!\[CDATA\[|\]\]>/g,'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim();
export function parseRss(xml,now=Date.now()){
 if(typeof xml!=='string'||xml.length>2000000)throw Error('INVALID_RSS');
 return [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].slice(0,60).map(m=>{
  const get=tag=>(m[1].match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`,'i'))||[])[1]||'';
  const title=unescape(get('title')).slice(0,250),url=unescape(get('link')).slice(0,350),published=Date.parse(unescape(get('pubDate')));
  return {title,url,published};
 }).filter(x=>x.title&&/^https:\/\//.test(x.url)&&Number.isFinite(x.published)&&x.published<=now+60000&&now-x.published<=2*3600000);
}
const important=/\b(list(?:ing|ed)|delist(?:ing|ed)?|hack(?:ed)?|exploit(?:ed)?|breach|sec|etf|lawsuit|approval|suspend(?:ed)?|halt(?:ed)?|unlock(?:ed|s)?|airdrop|bankrupt|liquidat(?:ion|ed)?|partnership|mainnet)\b/i;
export function matchNews(article,symbols){
 if(!important.test(article.title))return [];
 const title=article.title.toUpperCase();
 return symbols.filter(s=>{
  const token=s.replace(/USDT$/,'');
  if(token.length<3||['ONE','HOT','GAS','FUN','NEW','API','AI'].includes(token))return false;
  return new RegExp(`(^|[^A-Z0-9])${token}([^A-Z0-9]|$)`).test(title);
 }).slice(0,3);
}
