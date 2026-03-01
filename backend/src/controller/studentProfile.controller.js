import {supabaseForRequest } from "../lib/supabaseClient.js";

export const studentProfile = async(req, res) =>{
    try {
        const accessToken = req.cookies?.access_token;
        if (!accessToken) return res.status(401).json({ message: "Unauthorized" });

        const userId = req.user?.id;
        const user = req.user;

        if (!userId) return res.status(401).json({ message: "Unauthorized" });

        const supabaseUser = supabaseForRequest(accessToken);

        const { data: profile, error } = await supabaseUser
            .from("student_profiles")
            .select("user_id, id_number, first_name, last_name, suffix, program, role ,contact_number, address, created_at")
            .eq("user_id", userId)
            .maybeSingle();

        if (error) return res.status(400).json({ message: error.message });
        if (!profile) return res.status(404).json({ message: "Profile not found" });

        return res.status(200).json({ profile, user });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ message: "Internal server error" });
    }
}

export const changePassword = async (req, res) => {
    try {
        
        const access_token = req.cookies?.access_token;
        if(!access_token) return res.status(401).json({message: "Unauthorized"});
        
        const {currentPassword, newPassword} = req.body;

        if(!currentPassword || !newPassword) return res.status(400).json({message: "Current password and new password are required"});

        if(typeof newPassword !== "string" || newPassword.length < 8) return res.status(400).json({message: "New password must be atleast 8 characters"});
            
        const supabaseUser = supabaseForRequest(access_token);

        const email = req.user?.email;

        if(!email) return res.status(404).json({message: "User email not found"});

        const {error: reAuthError} = await supabaseUser.auth.signInWithPassword({
            email,
            password: currentPassword
        })

        if(reAuthError) return res.status(401).json({message: "Current password is incorrect"});

        const {data, error} = await supabaseUser.auth.updateUser({
            password: newPassword,
        });

        if(error) return res.status(400).json({message: error?.message});

        res.status(200).json({
            message: "Password updated successfully"
        });

    } catch (error) {
        console.log("Error in changePassword controller: ", error);
        res.status(500).json({message: "Internal server error"});
    }
}

export const changeEmail = async (req, res) => {
  try {
    const access_token = req.cookies?.access_token;
    const refresh_token = req.cookies?.refresh_token;

    if (!access_token || !refresh_token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { newEmail } = req.body;
    if (!newEmail) return res.status(400).json({ message: "New email is required" });

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    const supabaseUser = supabaseForRequest(access_token);

    // IMPORTANT: attach session to this client instance
    const { error: sessionError } = await supabaseUser.auth.setSession({
      access_token,
      refresh_token,
    });

    if (sessionError) {
      return res.status(401).json({ message: sessionError.message });
    }

    const { data, error } = await supabaseUser.auth.updateUser({ email: newEmail });
    if (error) return res.status(400).json({ message: error.message });

    return res.status(200).json({
      message: "Email update requested. Please verify the new email address.",
      user: data.user,
    });
  } catch (e) {
    console.error("changeEmailController error:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const changeNumber = async (req, res) =>{
    try {
        
        const access_token = req.cookies?.access_token;

        if(!access_token) return res.status(401).json({message: "unauthorized"});

        const userId = req.user?.id;
        if(!userId) return res.status(401).json({message: "Unauthorized"});

        const {newNumber} = req.body;

        const normalized = String(newNumber).trim();
        if (normalized.length < 11 || normalized.length > 11) {
            return res.status(400).json({ message: "Invalid contact number length" });
        }

        const supabaseUser = supabaseForRequest(access_token);

        const {data, error} = await supabaseUser
            .from("student_profiles")
            .update({contact_number: normalized})
            .eq("user_id", userId)
            .select("user_id, contact_number")
            .maybeSingle();


        if (error) return res.status(400).json({ message: error.message });
        if (!data) return res.status(404).json({ message: "Profile not found" });

        return res.status(200).json({
            message: "Contact number updated successfully",
            profile: data
        })

    } catch (error) {
        console.log("Error in changeNumber controller: ", error );
        res.status(500).json({message: "Internal server error"});
    }
}
