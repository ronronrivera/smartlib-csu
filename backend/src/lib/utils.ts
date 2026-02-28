import { ENV } from "./ENV.ts"
import type { Response } from "express"

export const setCookies = (res: Response, access_token: String | undefined, refresh_token: String | undefined, expires_in: number | undefined): void =>{
   
    if(!expires_in || !access_token || !refresh_token){
        console.log('expires_in or access_token or refresh_token is undefined');
        return;
    }

    res.cookie("access_token", access_token, {
        httpOnly: true,
        secure: ENV.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: expires_in * 1000
    })

    res.cookie("refresh_token", refresh_token, {
        httpOnly: true,
        secure: ENV.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
    })

}
