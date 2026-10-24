import {authorize,scanBatch} from '../../../lib/bot.mjs';
export const runtime='nodejs';export const maxDuration=60;
export async function GET(req){if(!authorize(req))return Response.json({error:'Unauthorized'},{status:401});const batch=Number(new URL(req.url).searchParams.get('batch'));if(!Number.isInteger(batch)||batch<0||batch>5)return Response.json({error:'batch must be 0..5'},{status:400});try{return Response.json(await scanBatch(batch))}catch(e){console.error(e);return Response.json({error:e.message},{status:500})}}
