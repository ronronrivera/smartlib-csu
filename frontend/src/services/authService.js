import { axiosInstance } from "../store/axios";

// Get borrower signups
export const getBorrowerSignups = async () => {
  try {
    const response = await axiosInstance.get("/borrowers");
    return response.data || [];
  } catch (error) {
    console.error("Failed to fetch borrower signups:", error);
    return [];
  }
};

// Get user profile by email
export const getUserProfileByEmail = (email) => {
  // This would typically fetch from the backend
  // For now, return a basic profile structure
  return {
    id: email?.split("@")[0] || "-",
    email: email || "-",
  };
};
