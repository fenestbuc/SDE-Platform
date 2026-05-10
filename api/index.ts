import express from 'express';
import app from '../src/server'; 

export default function(req: any, res: any) {
  // Strip /api from the URL to map to Express routes if needed, 
  // or Express routes already expect /api.
  // Actually the express app mounts routes at /api/auth etc.
  return app(req, res);
}
