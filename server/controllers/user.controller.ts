require ('dotenv').config();
import { Request,Response, NextFunction } from "express";
import userModel, { IUser } from "../models/user.model";
import ErrorHandler from "../utils/ErrorHandler";
import {CatchAsyncErrors} from "../middleware/catchAsyncErrors";
import jwt, {Secret, JwtPayload} from "jsonwebtoken";
import ejs from "ejs";
import path from "path";
import sendMail from "../utils/sendMail";
import { send } from "process";
import { accessTokenOptions, sendToken, refreshTokenOptions } from "../utils/jwt";
import { redis } from "../utils/redis";
import { get } from "http";
import { getAllUsersService, getUserById, updateUserRoleService } from "../services/user.service";
import  cloudinary  from "cloudinary";


// Register a user 
interface IRegistrationBody {
    name: string;
    email: string;
    password: string;
    avatar?: string;

} 


export const registrationUser = CatchAsyncErrors(async(req:Request,res:Response,next:NextFunction) => { 
   
    try {
        const {name, email, password} = req.body;

        const isEmailExist = await userModel.findOne({email}).maxTimeMS(20000);
        if(isEmailExist) {
            return next(new ErrorHandler("Email already exists", 400));
        
        };
        const user: IRegistrationBody = {
            name, 
            email,
            password,
        };

        const activationToken = createActivationToken(user);

        const activationCode = activationToken.activationCode;

        const data = {user: {name:user.name}, activationCode};

        const html = await ejs.renderFile(path.join(__dirname, "../mails/activation-mail.ejs"), data);

        try {
            await sendMail
            ({
                email: user.email,
                subject: "Account Activation",
                template: "activation-mail.ejs",
                data,
            });
            res.status(200).json({
                success: true,
                message: "Activation email sent successfully",
                activationToken: activationToken.token,
            });
        } catch (error:any) {
            return next(new ErrorHandler(error.message, 400));
        }
    }

    catch (error:any) {
        return next(new ErrorHandler(error.message,400));
}
});

interface IActivationToken {    
   token: string;
   activationCode: string;
}

export const createActivationToken = (user: any): IActivationToken => {

    const activationCode = Math.floor(1000 + Math.random() * 9000).toString();
   
    const token = jwt.sign({
        user, activationCode
    }, 
    process.env.ACTIVATION_SECRET as Secret,
    {
        expiresIn: "5m", 

    });
    return {token, activationCode};
    }
    
// Activate a user account

interface IActivationRequest {
    activationCode: string;
    activationToken: string;

}

export const activateUser = CatchAsyncErrors(async(req:Request,res:Response,next:NextFunction) => {
    try {
        const {activationCode, activationToken} = req.body as IActivationRequest;

       const newUser:{user: IUser; activationCode: string} = jwt.verify(activationToken, process.env.ACTIVATION_SECRET as string) as {user: IUser; activationCode: string};
        if (newUser.activationCode !== activationCode) {
            return next(new ErrorHandler("Invalid activation code", 400));
        }
        const {name, email, password} = newUser.user;
        const existUser = await userModel.findOne({email});
        if (existUser) {
            return next(new ErrorHandler("Email already exists", 400));
        }

        const user = await userModel.create({
            name,
            email,
            password,
        });

        res.status(201).json({
            success: true,
        
        });
    } catch (error:any) {
        return next(new ErrorHandler(error.message, 400));
    }
});



// Login a user

interface ILoginRequest {
    email: string;
    password: string;
}

export const loginUser = CatchAsyncErrors(async(req:Request,res:Response,next:NextFunction) => {
    try {
        const {email, password} = req.body as ILoginRequest;
        if(!email || !password) {
            return next(new ErrorHandler("Please enter email and password", 400));
        };

        const user = await userModel.findOne({email}).select("+password");

        if(!user) {
            return next(new ErrorHandler("Invalid email or password", 400));
        };

        const isPasswordMatched = await user.comparePassword(password);

        if(!isPasswordMatched) {
            return next(new ErrorHandler("Invalid email or password", 400));
        };

        sendToken(user, 200, res);

    }
    catch (error:any) {
        return next(new ErrorHandler(error.message, 400));
    }
});


// logout a user

export const logoutUser = CatchAsyncErrors(async(req:Request,res:Response,next:NextFunction) => {
    try {
        res.cookie('accessToken', '', {maxAge: 1});
        
        res.cookie('refreshToken', '', {maxAge: 1});
        
        const userId = req.user?._id || '';
        redis.del(userId);

        res.status(200).json({ 
            success: true,
            message: "Logged out successfully",
        });

    } catch (error:any) {
        return next(new ErrorHandler(error.message, 400));
    }
});


// update access token

export const updateAccessToken = CatchAsyncErrors(async(req:Request,res:Response,next:NextFunction) => {

    try {
        const refreshToken = req.cookies.refreshToken as string;

        const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN as string) as JwtPayload;

        const message = "Invalid token";

        if(!decoded) {
            return next(new ErrorHandler(message, 400));
        }

        const session = await redis.get(decoded.id);

        if(!session) {
            return next(new ErrorHandler("Please login to access this resource.", 400));
        }

        const user = JSON.parse(session);

        const accessToken = jwt.sign({id: user._id}, process.env.ACCESS_TOKEN as string, {expiresIn: "5m"});

        const refreshTokenNew = jwt.sign({id: user._id}, process.env.REFRESH_TOKEN as string, {expiresIn: "3d"});

        req.user = user;

        res.cookie('accessToken', accessToken, accessTokenOptions);
        res.cookie('refreshToken', refreshTokenNew, refreshTokenOptions);


        await redis.set(user._id, JSON.stringify(user), "EX", 604800);// 7days in seconds 
        res.status(200).json({
            status:"success",
            accessToken,
        });

    } catch (error:any) {
        return next(new ErrorHandler(error.message, 400));
    }

});


// get user info 

export const getUserInfo = CatchAsyncErrors(async(req:Request,res:Response,next:NextFunction) => {

    try {
        const userId = req.user?._id;
        getUserById(userId, res);
    
    } catch (error:any) {
        return next(new ErrorHandler(error.message, 400));
    }
        
    }

);

// social auth 

interface ISocialAuthBody {
    name: string;
    email: string;
    avatar: string;
   
}

export const socialAuth = CatchAsyncErrors(async(req:Request,res:Response,next:NextFunction) => {
    try {
        const {name, email, avatar} = req.body as ISocialAuthBody;
        const user = await userModel.findOne({email});
        if(!user){
          const newUser = await userModel.create({email, name, avatar});
          sendToken(newUser, 200, res);
        }
        else {
            sendToken(user, 200, res);
        }
    } catch (error:any) {
       return next(new ErrorHandler(error.message, 400));
    }
});


// update user info 

interface IUpdateUserInfo {
    name: string;
    email: string;
   
   
}

export const updateUserInfo = CatchAsyncErrors(async(req:Request,res:Response,next:NextFunction) => {

    try {
        const {name, email} = req.body as IUpdateUserInfo;
        const userId = req.user?._id;
        const user = await userModel.findById(userId);
        if(email && user ){
            const isEmailExist = await userModel.findOne({email});
            if(isEmailExist) {
                return next(new ErrorHandler("Email already exists", 400));
            }
            user.email = email;
        }

        if(name && user){
            user.name = name;
        }

        await user?.save();

        await redis.set(userId, JSON.stringify(user));
        
        res.status(200).json({
            success: true,
            user,
        });

    } catch (error:any) {
        return next(new ErrorHandler(error.message, 400));
    }
        
    }

);

// update password

interface IUpdatePassword {
    oldPassword: string;
    newPassword: string;
   
   
}

export const updatePassword = CatchAsyncErrors(async(req:Request,res:Response,next:NextFunction) => {

    try {
        const {oldPassword, newPassword} = req.body as IUpdatePassword;

        if(!oldPassword || !newPassword) {
            return next(new ErrorHandler("Please enter old and new password", 400));
        }

        const user = await userModel.findById(req.user?._id).select("+password");

        if(user?.password === undefined) {
            return next(new ErrorHandler("Invalid user", 400));
        }



        const isPasswordMatched = await user?.comparePassword(oldPassword);

        if(!isPasswordMatched) {
            return next(new ErrorHandler("Invalid password", 400));
        }

        user.password = newPassword;

        await user.save();

        await redis.set(req.user?._id, JSON.stringify(user));

        res.status(200).json({
            success: true,
            user,
        });
        
    } catch (error:any) {
        return next(new ErrorHandler(error.message, 400));
    }
        
    }

);

// upload profile picture

interface IUploadProfilePicture {
    avatar: {
        avatar: string;
    }
   
   
}

export const uploadProfilePicture = CatchAsyncErrors(async(req:Request,res:Response,next:NextFunction) => {

try {
    const {avatar} = req.body;

    const userId = req.user?._id;

    const user = await userModel.findById(userId);

   if(avatar && user){
    // check if user has an avatar
    if(user?.avatar?.public_id) {

        // delete previous avatar
        await cloudinary.v2.uploader.destroy(user?.avatar?.public_id);
        // upload new avatar
        const myCloud =  await cloudinary.v2.uploader.upload(avatar, {folder: "avatars", width: 150, crop: "scale"});

       user.avatar = {
              public_id: myCloud.public_id,
              url: myCloud.secure_url,
       }
    } else {
        // upload new avatar
        const myCloud =  await cloudinary.v2.uploader.upload(avatar, {folder: "avatars", width: 150, crop: "scale"});

       user.avatar = {
              public_id: myCloud.public_id,
              url: myCloud.secure_url,
       }
    }
   }

    await user?.save();
    await redis.set(userId, JSON.stringify(user));

    res.status(200).json({
        success: true,
        user,
    });

} catch (error:any) {
    return next(new ErrorHandler(error.message, 400));
}
    
}

);


// get all users -- for admin 

export const getAllUsers = CatchAsyncErrors(async(req:Request,res:Response,next:NextFunction) => {

    try {

        getAllUsersService(res);
        
    } catch (error:any) {
        return next(new ErrorHandler(error.message, 400));
    }
        
    }
);

// update user role -- for admin

export const updateUserRole = CatchAsyncErrors(async(req:Request,res:Response,next:NextFunction) => {

    try {
      
        const {id, role} = req.body;
        updateUserRoleService(res, id, role);
        
    } catch (error:any) {
        return next(new ErrorHandler(error.message, 400));
    }
        
    }

);

// delete user -- for admin

export const deleteUser = CatchAsyncErrors(async(req:Request,res:Response,next:NextFunction) => {

    try {
      
        const {id} = req.params
        const user = await userModel.findById(id);

        if(!user) {
            return next(new ErrorHandler("User not found", 400));
        }

        await user.deleteOne( { id } );

        await redis.del(id);

        res.status(200).json({
            success: true,
            message: "User deleted successfully",
        });
        
    } catch (error:any) {
        return next(new ErrorHandler(error.message, 400));
    }
        
    }

);