import { supabase } from "../lib/supabaseClient.ts"
import type { Response, Request } from "express";
import { setCookies } from "../lib/utils.ts";

export const signupController = async (req: Request, res: Response) => {
    const {
        email,
        password,

        // student fields
        idNumber,
        firstName,
        lastName,
        suffix,
        program,
        yearLevel,
        contactNumber,
        address,
    } = req.body;

    // ---- validations ----
    if (!firstName || !lastName) {
        return res.status(400).json({ message: "First name and last name are required" });
    }

    if (!idNumber) return res.status(400).json({ message: "ID Number is required" });
    if (!program) return res.status(400).json({ message: "Program is required" });
    if (yearLevel === undefined || yearLevel === null || yearLevel === "") {
        return res.status(400).json({ message: "Year level is required" });
    }

    if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ message: "Invalid email format" });
    }

    if (typeof password !== "string" || password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    const parsedYearLevel = Number(yearLevel);
    if (!Number.isInteger(parsedYearLevel) || parsedYearLevel < 1) {
        return res.status(400).json({ message: "Year level must be a positive integer" });
    }

    try {
        // 1) Create auth user (Supabase Auth)
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
        });

        if (error) {
            return res.status(400).json({ message: error.message });
        }

        const userId = data.user?.id;
        if (!userId) return res.status(400).json({ message: "User not returned!" });

        // 2) Insert student profile into student_profiles (NOT "users")
        //    user_id must match auth.users.id
        const { data: studentProfile, error: profileError } = await supabase
            .from("student_profiles")
            .insert([
                {
                    user_id: userId,
                    id_number: String(idNumber).trim(),
                    first_name: String(firstName).trim(),
                    last_name: String(lastName).trim(),
                    suffix: suffix ? String(suffix).trim() : null,
                    program: String(program).trim(),
                    year_level: parsedYearLevel,
                    contact_number: contactNumber ? String(contactNumber).trim() : null,
                    address: address ? String(address).trim() : null,
                },
            ])
            .select(
                "user_id, id_number, first_name, last_name, suffix, program, year_level, contact_number, address, created_at"
            )
            .single();

        if (profileError) {
            // Optional cleanup: delete auth user if profile insert fails (requires admin/service role)
            // For now, just return the error:
            return res.status(400).json({ message: profileError.message });
        }

        // 3) Set cookies if session exists (depends on your Supabase email confirmation settings)
        const { refresh_token, access_token, expires_in } = data.session || {};

        if (access_token && refresh_token && expires_in) {
            setCookies(res, access_token, refresh_token, expires_in);
        }

        return res.status(201).json({
            message: "Student account created successfully",
            profile: studentProfile,
            user: data.user,
        });
    } catch (error) {
        console.log("Error in signup controller: ", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

export const loginController = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return res.status(401).json({ error: error.message });
    }

    const userId = data.user?.id;
    if (!userId) return res.status(404).json({ message: "User id not found" });

    const { data: profileData, error: profileError } = await supabase
      .from("student_profiles")
      .select(
        "user_id, id_number, first_name, last_name, suffix, program, year_level, contact_number, address"
      )
      .eq("user_id", userId)
      .single();

    if (profileError || !profileData) {
      return res.status(404).json({ message: "Student profile not found" });
    }

    const { refresh_token, access_token, expires_in } = data.session || {};

    // Authenticate user via cookies
    setCookies(res, access_token, refresh_token, expires_in);

    return res.status(200).json({
      message: "Login successful",
      profile: profileData,
      user: data.user,
    });
  } catch (err) {
    console.error("Error in login controller: ", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const logoutController = async (_: any, res: Response) => {
  try {

    res.clearCookie("access_token");
    res.clearCookie("refresh_token");

    return res.status(200).json({ message: "Logout Successfully" });
  } catch (error) {
    console.log("Error in logout Controller: ", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const refreshToken = async (req: Request, res: Response) =>{
    try {
       
        const refresh_token = req.cookies?.refresh_token;

        if(!refresh_token) return res.status(401).json({message: "Refresh token not found"});

        const {data, error} = await supabase.auth.refreshSession({refresh_token});

        if(error || !data) return res.status(401).json({message: error?.message ?? "Could not refresh token"});

        const {access_token ,refresh_token: new_refresh_token, expires_in} = data.session;

        setCookies(res, access_token, new_refresh_token, expires_in);
        
        res.status(200).json({
            message: "Session refresh",
        })


    } catch (error) {
       console.log("Error in refreshToken controller: ", error);
        res.status(500).json({message: "Internal server error"});
    }
}
