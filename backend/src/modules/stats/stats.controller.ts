import { Request, Response } from 'express';
import * as statsService from './stats.service';
import * as analyticsService from './analytics.service';

export async function trends(req: Request, res: Response): Promise<Response> {
  const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 8));
  return res.json(await statsService.getTrends(limit));
}

export async function ranking(req: Request, res: Response): Promise<Response> {
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  return res.json(await statsService.getRanking(limit));
}

export async function overview(_req: Request, res: Response): Promise<Response> {
  return res.json(await statsService.getOverview());
}

export async function timeSeries(req: Request, res: Response): Promise<Response> {
  const days = Math.min(180, Math.max(7, Number(req.query.days) || 30));
  return res.json(await analyticsService.getTimeSeries(days));
}

export async function distributions(_req: Request, res: Response): Promise<Response> {
  return res.json(await analyticsService.getDistributions());
}

export async function topLists(req: Request, res: Response): Promise<Response> {
  const limit = Math.min(25, Math.max(3, Number(req.query.limit) || 10));
  return res.json(await analyticsService.getTopLists(limit));
}

export async function walletStats(_req: Request, res: Response): Promise<Response> {
  return res.json(await analyticsService.getWalletStats());
}

export async function systemHealth(_req: Request, res: Response): Promise<Response> {
  return res.json(await analyticsService.getSystemHealth());
}

export async function geoDistribution(_req: Request, res: Response): Promise<Response> {
  return res.json(await analyticsService.getGeoDistribution());
}
