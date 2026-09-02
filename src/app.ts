import express, { type NextFunction, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import { StatusCodes } from 'http-status-codes';
import { config } from './config';
import { requestLogger } from './middlewares/requestLogger';
import { AppRoutes } from './routes';
import { ApiError } from './shared/ApiError';
import { sendResponse } from './shared/sendResponse';
import { globalErrorHandler } from './shared/globalErrorHandler';

export const app = express();

app.set('trust proxy', 1);
app.use(
  helmet({
    // HSTS on HTTP localhost makes Chrome refuse the page after the first visit.
    strictTransportSecurity: config.NODE_ENV === 'production',
  }),
);
app.use(compression());
app.use(
  cors({
    origin: config.CLIENT_URL,
    credentials: true,
  }),
);
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(requestLogger);

app.get('/', (_req: Request, res: Response) => {
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Bidyapith API is running',
  });
});

app.get('/health', (_req: Request, res: Response) => {
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'OK',
    data: { service: 'bidyapith-backend' },
  });
});

app.use('/api/v1', AppRoutes);

app.use((req: Request, _res: Response, next: NextFunction) => {
  next(new ApiError(StatusCodes.NOT_FOUND, `Route ${req.method} ${req.originalUrl} not found`));
});

app.use(globalErrorHandler);
