import express from 'express';
import { activateUser, registrationUser, loginUser, logoutUser, updateAccessToken, getUserInfo, socialAuth, updateUserInfo, updatePassword, uploadProfilePicture, getAllUsers, updateUserRole, deleteUser} from '../controllers/user.controller';
import { authorizeRoles, isAuthenticated } from '../middleware/auth';
import { updateUserRoleService } from '../services/user.service';

const userRouter = express.Router();

userRouter.post('/registration', registrationUser);

userRouter.post('/activate-user', activateUser);

userRouter.post('/login', loginUser);

userRouter.get('/logout', isAuthenticated, logoutUser);

userRouter.get('/refresh', updateAccessToken);

userRouter.get('/me', isAuthenticated, getUserInfo);

userRouter.post('/social-auth', socialAuth);

userRouter.put('/updateuser', isAuthenticated, updateUserInfo);

userRouter.put('/updatePassword' , isAuthenticated, updatePassword);

userRouter.put('/uploadProfilePicture', isAuthenticated, uploadProfilePicture);

userRouter.get('/get-users', isAuthenticated, authorizeRoles("admin") , getAllUsers);

userRouter.put('/change-user-role', isAuthenticated, authorizeRoles("admin") , updateUserRole);

userRouter.delete('/delete-user/:id', isAuthenticated, authorizeRoles("admin") , deleteUser);


export default userRouter;