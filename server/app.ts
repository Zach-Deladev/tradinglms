require ('dotenv').config();
import express, { Request, Response, NextFunction } from 'express';
export const app = express();
import cors from 'cors';
import cookieParser from 'cookie-parser';
import {ErrorMiddleware} from './middleware/error';
import userRouter from './routes/user.routes';
import courseRouter from './routes/course.routes';
import orderRouter from './routes/order.routes';
import notificationRouter from './routes/notification.routes';
import analyticsRouter from './routes/analytics.routes';
import layoutRouter from './routes/layout.routes';

// Body parser
app.use(express.json({limit: '50mb'}));

// Cookie parser
app.use(cookieParser());

// Cors
app.use(cors({ origin: process.env.ORIGIN}));

// Routes
app.use('/api/v1', userRouter, courseRouter, orderRouter, notificationRouter, analyticsRouter, layoutRouter);


// Testing Api
    app.get('/test', (req:Request, res:Response, next:NextFunction) => {
        res.status(200).json({
        success: true,
        message:"APi is working"
    });
});

// Unknown route
app.all('*', (req:Request, res:Response, next:NextFunction) => {
    const err = new Error(`Can't find ${req.originalUrl} on this server`) as any;
    err.statusCode = 404;
    next(err);
});

app.use(ErrorMiddleware);