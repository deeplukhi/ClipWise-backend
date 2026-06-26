import { Request, Response, NextFunction } from 'express';

export interface DeviceRequest extends Request {
  deviceId?: string;
}

export function deviceMiddleware(req: DeviceRequest, _res: Response, next: NextFunction) {
  req.deviceId = (req.headers['x-device-id'] as string) || undefined;
  next();
}
