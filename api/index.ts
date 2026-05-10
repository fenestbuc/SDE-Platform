import app from '../src/server';
import express from 'express';

export default function(req: any, res: any) {
  return app(req, res);
}
