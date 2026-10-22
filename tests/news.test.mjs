import test from 'node:test';import assert from 'node:assert/strict';
import {parseRss,matchNews} from '../lib/news.js';
test('RSS only fresh articles with https links',()=>{const now=Date.parse('2026-10-22T12:00:00Z');const xml=`<rss><channel><item><title>BTC listing confirmed</title><link>https://example.com/1</link><pubDate>Thu, 22 Oct 2026 11:00:00 GMT</pubDate></item><item><title>old</title><link>https://example.com/2</link><pubDate>Wed, 21 Oct 2026 11:00:00 GMT</pubDate></item></channel></rss>`;const out=parseRss(xml,now);assert.equal(out.length,1);assert.deepEqual(matchNews(out[0],['BTCUSDT','ETHUSDT']),['BTCUSDT']);});
test('Generic tokens do not trigger on incidental headlines',()=>{assert.deepEqual(matchNews({title:'New AI partnership'},['AIUSDT','ONEUSDT']),[])});
