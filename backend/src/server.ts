import express from "express"
import { ENV } from "./lib/ENV.ts";
import authRoutes from "./routes/auth.routes.ts";
import cookieParser from "cookie-parser";
import cors from "cors";
import { refreshToken } from "./controller/auth.controller.ts";

const app = express()

app.use(express.json());
app.use(cookieParser());
app.use(cors({
    origin: ENV.CLIENT_URL,
    credentials: true,
}))


app.use("/api/auth", authRoutes);

if(!ENV.SERVERLESS){
    app.listen(ENV.PORT, () =>{
        console.log("Server is running on port ", ENV.PORT);
    });
}

export default app;
