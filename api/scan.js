import {scan,authorized} from '../lib/core.js';

export default async function handler(req,res){
  if(!authorized(req)) return res.status(401).json({error:'Unauthorized'});
  if(req.method!=='GET') return res.status(405).json({error:'GET only'});
  // Avoid Vercel's req.query getter, which invokes deprecated url.parse().
  // cron-job.org must send X-Scan-Batch: 0..5 for the corresponding job.
  const raw=req.headers['x-scan-batch'];
  if(typeof raw!=='string'||!/^[0-9]+$/.test(raw)) return res.status(400).json({error:'Missing/invalid X-Scan-Batch header (expected 0..5)'});
  try{return res.status(200).json(await scan(Number(raw)))}
  catch(e){return res.status(500).json({error:String(e.message)})}
}
