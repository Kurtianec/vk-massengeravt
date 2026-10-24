import {authorize,report} from '../../../lib/bot.mjs';
export const runtime='nodejs';export const maxDuration=60;
export async function GET(req){if(!authorize(req))return Response.json({error:'Unauthorized'},{status:401});try{return Response.json(await report())}catch(e){console.error(e);return Response.json({error:e.message},{status:500})}}
