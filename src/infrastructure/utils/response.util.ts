import { Response } from 'express';

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export class ResponseUtil {
  static success<T>(res: Response, data?: T, message?: string, statusCode: number = 200): Response {
    const response: ApiResponse<T> = { success: true, message, data };
    return res.status(statusCode).json(response);
  }

  static created<T>(res: Response, data?: T, message: string = 'Resource created successfully'): Response {
    return this.success(res, data, message, 201);
  }

  static error(res: Response, message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR', details?: any): Response {
    const response: ApiResponse = { success: false, error: { code, message, details } };
    return res.status(statusCode).json(response);
  }
}
