import type { Request, Response, NextFunction } from "express"
import { supabase } from "../lib/supabaseClient.ts";

const protectRoute = async (req: Request, res: Response, next: NextFunction) =>{
    try {

        const token = req.cookies.access_token;

        if(!token) return res.status(401).json({message: "Unauthorized"});

        const {data, error} = await supabase.auth.getUser(token);
        
        if(error || !data) return res.status(401).json({message: "Invalid token"});

        req.user = data.user;

        next();

    } catch (error) {

    }
}

export default protectRoute;
