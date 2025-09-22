import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { config } from '../config';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const errorHandler = (
  err: Error | AppError | Joi.ValidationError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let statusCode = 500;
  let message = 'Internal Server Error';
  let details = undefined;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err instanceof Joi.ValidationError) {
    statusCode = 400;
    message = 'Validation Error';
    details = err.details.map((detail) => ({
      field: detail.path.join('.'),
      message: detail.message,
    }));
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  // Log error
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    statusCode,
    url: req.url,
    method: req.method,
    body: req.body,
  });

  // Send response
  res.status(statusCode).json({
    error: {
      message,
      ...(details && { details }),
      ...(config.env === 'development' && { stack: err.stack }),
    },
  });
};
