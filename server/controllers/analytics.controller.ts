import { Request, Response, NextFunction } from 'express';
import ErrorHandler from '../utils/ErrorHandler';
import { CatchAsyncErrors } from '../middleware/catchAsyncErrors';
import { generateLast12MonthsData } from '../utils/analytics.generator';
import userModel from '../models/user.model';
import CourseModel from '../models/course.model';
import OrderModel from '../models/orderModel';


// get user analytics -- for admin 

export const getUserAnalytics = CatchAsyncErrors(async (req: Request, res: Response, next: NextFunction) => {

    try {
        const users = await generateLast12MonthsData(userModel);
        res.status(200).json({
            success: true,
            users
        });        
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));   
    }
});

// get course analytics -- for admin

export const getCoursesAnalytics = CatchAsyncErrors(async (req: Request, res: Response, next: NextFunction) => {

    try {
        const courses = await generateLast12MonthsData(CourseModel);
        res.status(200).json({
            success: true,
            courses
        });        
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));   
    }
});

// get order analytics -- for admin

export const getOrderAnalytics = CatchAsyncErrors(async (req: Request, res: Response, next: NextFunction) => {

    try {
        const orders = await generateLast12MonthsData(OrderModel);
        res.status(200).json({
            success: true,
            orders
        });        
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));   
    }
});
