import exress from 'express';
import { authorizeRoles, isAuthenticated } from '../middleware/auth';
import { createOrder, getAllOrders } from '../controllers/order.controller';


const orderRouter = exress.Router();

orderRouter.post('/create-order', isAuthenticated, createOrder);

orderRouter.get('/get-order', isAuthenticated, authorizeRoles("admin") , getAllOrders);


export default orderRouter;