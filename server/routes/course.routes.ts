import express from 'express';
import { addAnswer, addQuestion, addReplyReview, addReview, deleteCourse, editCourse, getAllCourse, getAllCourses, getCourseByUser, getSingleCourse, uploadCourse } from '../controllers/course.controller';
import { authorizeRoles, isAuthenticated } from '../middleware/auth';
import { get } from 'http';
const courseRouter = express.Router();



courseRouter.post("/create-course", isAuthenticated, authorizeRoles("admin"),  uploadCourse);

courseRouter.put("/edit-course/:id", isAuthenticated, authorizeRoles("admin"),  editCourse);

courseRouter.get("/get-course/:id",   getSingleCourse);

courseRouter.get("/get-all-course/:id",   getAllCourses);

courseRouter.get("/get-course-content/:id",  isAuthenticated, getCourseByUser);

courseRouter.put("/add-question",  isAuthenticated, addQuestion);

courseRouter.put("/add-answer",  isAuthenticated, addAnswer);

courseRouter.put("/add-review/:id",  isAuthenticated, addReview);

courseRouter.put("/add-reply-review",  isAuthenticated, authorizeRoles("admin"), addReplyReview);

courseRouter.get("/get-courses",  isAuthenticated, authorizeRoles("admin"), getAllCourse);

courseRouter.delete("/delete-course/:id",  isAuthenticated, authorizeRoles("admin"), deleteCourse);





export default courseRouter;