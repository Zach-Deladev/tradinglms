import { NextFunction, Request, Response } from "express";
import { CatchAsyncErrors } from "../middleware/catchAsyncErrors";
import ErrorHandler from "../utils/ErrorHandler";
import cloudinary from "cloudinary";
import { createCourse, getAllCoursesService } from "../services/course.service";
import CourseModel from "../models/course.model";
import { redis } from "../utils/redis";
import mongoose, { mongo } from "mongoose";
import path from "path";
import ejs from "ejs";
import sendMail from "../utils/sendMail";
import NotificationModel from "../models/notificationModel";



// upload course 

export const uploadCourse = CatchAsyncErrors(async (req: Request, res: Response, next: NextFunction) => {
    try {
        
        const data = req.body;
        const thumbnail = data.thumbnail;
        if(thumbnail){
            const myCloud = await cloudinary.v2.uploader.upload(thumbnail, {
                folder: "courses",
        } );

        data.thumbnail = {
            public_id: myCloud.public_id,
            url: myCloud.secure_url,
        };}
    createCourse(data, res, next);

  }catch (error: any) {

        next(new ErrorHandler(error.message, 400));

    }
});

// edit course

export const editCourse = CatchAsyncErrors(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = req.body;

        const thumbnail = data.thumbnail;

        if(thumbnail){

           await cloudinary.v2.uploader.destroy(data.thumbnail.public_id);

            const myCloud = await cloudinary.v2.uploader.upload(thumbnail, {
                folder: "courses",
        });
        
        data.thumbnail = {
            public_id: myCloud.public_id,
            url: myCloud.secure_url,
        } 
    };

   const courseId = req.params.id;

   const course = await CourseModel.findByIdAndUpdate(
    courseId,
     {
    $set: data
    },
    {new: true});

    res.status(200).json({
        success: true,
        course,
    });

    } catch (error: any) {
            next(new ErrorHandler(error.message, 400));
        }
});

// get single course -- without purchasing 

export const getSingleCourse = CatchAsyncErrors(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const courseId = req.params.id;

        const isCacheExist = await redis.get(courseId);

        if(isCacheExist){
            const course = JSON.parse(isCacheExist);
            res.status(200).json({
                success: true,
                course,
            });
        } else {const course = await CourseModel.findById(req.params.id).select("-courseData.videoUrl -courseData.suggestion -courseData.questions -courseData.links");
        
        await redis.set(courseId, JSON.stringify(course), "EX", 604800); // 7 days in seconds

        res.status(200).json({
            success: true,
            course,
        });
    }

        
    } catch (error: any) {
        next(new ErrorHandler(error.message, 500));
    }
} );

// get all courses -- without purchasing

export const getAllCourses = CatchAsyncErrors(async (req: Request, res: Response, next: NextFunction) => {
    try {

        const isCacheExist = await redis.get("allCourses");
        if (isCacheExist){
            const courses = JSON.parse(isCacheExist);
            res.status(200).json({
                success: true,
                courses,
            });
        } else {

        const courses = await CourseModel.find().select("-courseData.videoUrl -courseData.suggestion -courseData.questions -courseData.links");
            await redis.set("allCourses", JSON.stringify(courses));
        res.status(200).json({
            success: true,
            courses,
        });

    }
    } catch (error: any) {
        next(new ErrorHandler(error.message, 500));
    }
} );

// get course content -- only for valid users

export const getCourseByUser = CatchAsyncErrors(async (req: Request, res: Response, next: NextFunction) => {

    try {
        const userCourseList = req.user?.courses;
        const courseId = req.params.id;


        const courseExist = userCourseList?.find((course:any) => course._id.toString() === courseId);
        
        if(!courseExist){
            return next(new ErrorHandler("You have not purchased this course", 404));
        }

        const course = await CourseModel.findById(courseId);

        const content = course?.courseData;

        res.status(200).json({
            success: true,
            content,
        });

    } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
    }

}  );


// add questions to course

interface IAddQuestionData {

    question: string;
    courseId: string;
    contentId: string;

}

export const addQuestion = CatchAsyncErrors(async (req: Request, res: Response, next: NextFunction) => {

    try {
        const {question, courseId, contentId}: IAddQuestionData = req.body;
        const course = await CourseModel.findById(courseId);

        if(!mongoose.Types.ObjectId.isValid(contentId)){
            return next(new ErrorHandler("Invalid content id", 400));
        }

        const courseContent = course?.courseData?.find((item: any) => item._id.equals(contentId));

        if(!courseContent){
            return next(new ErrorHandler("Invalid content id", 400));
        }

        // create a new question object

        const newQuestion: any = {
            user: req.user,
             question,
           questionReplies: [],
        };

        // add question to course content

        courseContent.questions.push(newQuestion);

        await NotificationModel.create({
            user: req.user?._id,
            title: "New Question received",
            message: `${req.user?.name} has added a question to your course ${courseContent.title} in ${course?.name}`,
        });

        // save the updated course

        await course?.save();

        res.status(200).json({
            success: true,
            course
        });
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
    }
        
    }

);


// add replies to questions

interface IAddReplyData {
    answer: string;
    courseId: string;
    contentId: string;
    questionId: string;
}

export const addAnswer = CatchAsyncErrors(async (req: Request, res: Response, next: NextFunction) => {
    try {

        const {answer, courseId, contentId, questionId}: IAddReplyData = req.body;

        const course = await CourseModel.findById(courseId);

        if(!mongoose.Types.ObjectId.isValid(contentId)){
            return next(new ErrorHandler("Invalid content id", 400));
        }

        const courseContent = course?.courseData?.find((item: any) => item._id.equals(contentId));

        if(!courseContent){
            return next(new ErrorHandler("Invalid content id", 400));
        }

        // get the question

        const question = courseContent.questions.find((item: any) => item._id.equals(questionId));

        if(!question){
            return next(new ErrorHandler("Invalid question id", 400));
        }

        // create a new answer object

        const newAnswer: any = {
            user: req.user,
            answer,
        };

        // add answer to question

        question.questionReplies.push(newAnswer);

        // save the updated course

        await course?.save();

        if(req.user?._id === question.user._id){
            // create notification 
            await NotificationModel.create({
                user: req.user?._id,
                title: "New Reply received",
                message: `${req.user?.name} has added a reply to your question answer in ${courseContent.title} in ${course?.name}`,
            });
            
        } else {
            const data = {
                name: question.user.name,
                title: courseContent.title,
        } 
         const html = await ejs.renderFile(path.join(__dirname, "../emails/question-reply.ejs"), data);

         try {
            
            await sendMail({
                email: question.user.email,
                subject: "Question Reply",
                template: "question-reply.ejs",
                data,
            });

         } catch (error: any) {
            return next(new ErrorHandler(error.message, 500));
         }
        }
        res.status(200).json({
        
            success: true,
            course,
        });
        
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
    }
});

// add review to course

interface IAddReviewData {

    review: string;
    rating: number;
    userId: string;
}

export const addReview = CatchAsyncErrors(async (req: Request, res: Response, next: NextFunction) => {

    try {
        
        const userCourseList = req.user?.courses;

        const courseId = req.params.id;

        //check if courseId exist in user course list based on user id

        const courseExist = userCourseList?.some((course:any) => course._id.toString() === courseId.toString());

        if(!courseExist){
            return next(new ErrorHandler("You have not purchased this course", 404));
        }

        const course = await CourseModel.findById(courseId);

        const {review, rating} = req.body as IAddReviewData;

        const reviewData:any = {
            user: req.user,
            comment: review, 
            rating,
        }

        course?.reviews.push(reviewData);

        let avg = 0;

        course?.reviews.forEach((rev: any) => {
        
            avg += rev.rating;
        
        });

        if(course) {
            course.ratings = avg / course.reviews.length;
        }

        await course?.save();

        const notification = {
            title: "New Review received",
            message: `${req.user?.name} has added a review to your course ${course?.name}`,

        }
        // create notification

        res.status(200).json({
            success: true,
            course,
        });

    } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
    }

});

// add reply to review

interface IAddReplyReviewData {
    comment: string;
    courseId: string;
    reviewId: string;
}

export const addReplyReview = CatchAsyncErrors(async (req: Request, res: Response, next: NextFunction) => {

    try {
        
        const {comment, courseId, reviewId} = req.body as IAddReplyReviewData;

        const course = await CourseModel.findById(courseId);

        if(!course){
            return next(new ErrorHandler("Course not found", 404));
        }

        const review = course.reviews.find((rev: any) => rev._id.toString() === reviewId);

        if(!review){
            return next(new ErrorHandler("Review not found", 404));
        }

        const replyData:any = {
            user: req.user,
            comment,
        }

        if(!review.commentReplies){
            review.commentReplies = [];
        }

        review.commentReplies?.push(replyData);

        await course?.save();

        res.status(200).json({
            success: true,
            course,
        });

    } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
    }

});

// get all courses -- for admin 
export const getAllCourse = CatchAsyncErrors(async(req:Request,res:Response,next:NextFunction) => {

    try {

        getAllCoursesService(res);
        
    } catch (error:any) {
        return next(new ErrorHandler(error.message, 400));
    }
        
    }
);

// delete course -- for admin


export const deleteCourse = CatchAsyncErrors(async(req:Request,res:Response,next:NextFunction) => {

    try {
      
        const {id} = req.params
        const course = await CourseModel.findById(id);

        if(!course) {
            return next(new ErrorHandler("Course not found", 400));
        }

        await course.deleteOne( { id } );

        await redis.del(id);

        res.status(200).json({
            success: true,
            message: "Course deleted successfully",
        });
        
    } catch (error:any) {
        return next(new ErrorHandler(error.message, 400));
    }
        
    }

);