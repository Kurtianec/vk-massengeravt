import {report,authorized} from '../lib/core.js';
export default async function handler(req,res){if(!authorized(req))return res.status(401).json({error:'Unauthorized'});if(req.method!=='GET')return res.status(405).json({error:'GET only'});try{return res.status(200).json(await report())}catch(e){return res.status(500).json({error:String(e.message)})}}
