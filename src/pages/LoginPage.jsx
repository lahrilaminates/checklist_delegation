"use client"

import { useState, useEffect } from "react"
import { useDispatch, useSelector } from "react-redux"
import { useNavigate } from "react-router-dom"

import { loginUser } from "../redux/slice/loginSlice"
import { LoginCredentialsApi } from "../redux/api/loginApi"
import { useMagicToast } from "../context/MagicToastContext"
import supabase from "../SupabaseClient"
import { sendPasswordResetOTP } from "../services/whatsappService"
import { KeyRound, ShieldCheck, User as UserIcon, ArrowLeft, RefreshCw, Smartphone, Eye, EyeOff } from "lucide-react"

const LoginPage = () => {
  const navigate = useNavigate()
  const { isLoggedIn, userData, error } = useSelector((state) => state.login);
  const dispatch = useDispatch();
  const { showToast } = useMagicToast();

  const [isLoginLoading, setIsLoginLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  })

  // Forgot Password State
  const [showForgotModal, setShowForgotModal] = useState(false)
  const [forgotStep, setForgotStep] = useState('username') // 'username', 'otp', 'reset'
  const [forgotData, setForgotData] = useState({
    username: "",
    otp: "",
    newPassword: "",
    confirmPassword: "",
    generatedOtp: ""
  })
  const [isForgotLoading, setIsForgotLoading] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsLoginLoading(true);
    dispatch(loginUser(formData));
  };

  useEffect(() => {
    const handleLoginSuccess = async () => {
      if (isLoggedIn && userData) {
        console.log("User Data received:", userData); // Debug log

        let designation = userData.Designation || userData.designation || "";

        // If designation is missing, try fetching it explicitly
        if (!designation && userData.user_name) {
          try {
            const { data } = await supabase
              .from('users')
              .select('Designation')
              .eq('user_name', userData.user_name || userData.username)
              .single();
            if (data) {
              designation = data.Designation || "";
            }
          } catch (err) {
            console.error("Error fetching designation:", err);
          }
        }

        // Store all user data in localStorage
        localStorage.setItem('user-name', userData.user_name || userData.username || "");
        localStorage.setItem('user-id', userData.id || "");
        localStorage.setItem('role', userData.role || "");
        localStorage.setItem('email_id', userData.email_id || userData.email || "");
        localStorage.setItem('user_access', userData.user_access || "");
        localStorage.setItem('profile_image', userData.profile_image || "");
        localStorage.setItem('can_self_assign', userData.can_self_assign === true ? "true" : "false");
        localStorage.setItem('designation', designation);

        console.log("Stored email:", userData.email_id || userData.email); // Debug log

        showToast(`Welcome back, ${userData.user_name || userData.username}!`, "success");
        navigate("/dashboard/admin");
      } else if (error) {
        showToast(error, "error");
        setIsLoginLoading(false);
      }
    };

    handleLoginSuccess();
  }, [isLoggedIn, userData, error, navigate, showToast]);




  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 p-4">
      <div className="w-full max-w-md shadow-lg border border-blue-200 rounded-lg bg-white">
        <div className="space-y-1 p-4 bg-gradient-to-r from-blue-100 to-purple-100 rounded-t-lg">
          {/* <img
            src="/logo.png"
            alt="Company Logo"
            className="h-auto w-100 mr-3"
          /> */}
          <h2 className="text-2xl font-bold text-blue-700 p-2 items-center justify-center">TaskDesk</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="space-y-2">
            <label htmlFor="username" className="flex items-center text-blue-700">
              <i className="fas fa-user h-4 w-4 mr-2"></i>
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              placeholder="Enter your username"
              required
              value={formData.username}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="flex items-center text-blue-700">
              <i className="fas fa-key h-4 w-4 mr-2"></i>
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                required
                value={formData.password}
                onChange={handleChange}
                className="w-full pl-3 pr-10 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-700 focus:outline-none"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 -mx-4 -mb-4 mt-4 rounded-b-lg flex flex-col gap-3">
            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-bold hover:opacity-90 transition-all shadow-md active:scale-[0.98] disabled:opacity-50"
              disabled={isLoginLoading}
            >
              {isLoginLoading ? "Logging in..." : "Login"}
            </button>
            <button
              type="button"
              onClick={() => setShowForgotModal(true)}
              className="text-sm font-bold text-blue-600 hover:text-blue-800 transition-colors text-center"
            >
              Forgot Password?
            </button>
          </div>
        </form>

        {/* Forgot Password Modal */}
        {showForgotModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => !isForgotLoading && setShowForgotModal(false)}></div>
            <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 border border-blue-50">
              <div className="bg-gradient-to-br from-blue-50 to-white px-6 py-6 text-center">
                <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                  {forgotStep === 'username' && <UserIcon className="text-blue-600" size={32} />}
                  {forgotStep === 'otp' && <ShieldCheck className="text-blue-600" size={32} />}
                  {forgotStep === 'reset' && <KeyRound className="text-blue-600" size={32} />}
                </div>
                <h3 className="text-xl font-black text-gray-900 leading-tight">
                  {forgotStep === 'username' && "Find Your Account"}
                  {forgotStep === 'otp' && "Verify Identity"}
                  {forgotStep === 'reset' && "Set New Password"}
                </h3>
              </div>

              <div className="px-6 pb-8 space-y-4">
                {forgotStep === 'username' && (
                  <div className="space-y-4">
                    <p className="text-xs text-gray-500 text-center px-2">Enter your username. An OTP will be sent to the Admin for verification.</p>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Username"
                        value={forgotData.username}
                        onChange={(e) => setForgotData({ ...forgotData, username: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all"
                      />
                      <UserIcon className="absolute left-3 top-3.5 text-gray-400" size={18} />
                    </div>
                    <button
                      onClick={async () => {
                        if (!forgotData.username) return showToast("Please enter username", "error");
                        setIsForgotLoading(true);
                        try {
                          const { data, error } = await supabase.from('users').select('user_name').eq('user_name', forgotData.username).single();
                          if (error || !data) return showToast("User not found", "error");

                          const otp = Math.floor(100000 + Math.random() * 900000).toString();
                          await sendPasswordResetOTP(forgotData.username, otp);
                          setForgotData({ ...forgotData, generatedOtp: otp });
                          setForgotStep('otp');
                          showToast("OTP sent to Admin", "success");
                        } catch (err) {
                          showToast("Error processing request", "error");
                        } finally {
                          setIsForgotLoading(false);
                        }
                      }}
                      disabled={isForgotLoading}
                      className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                    >
                      {isForgotLoading ? <RefreshCw className="animate-spin" size={18} /> : "Send OTP"}
                    </button>
                    <button onClick={() => setShowForgotModal(false)} className="w-full py-2 text-xs font-bold text-gray-400 hover:text-gray-600">Cancel</button>
                  </div>
                )}

                {forgotStep === 'otp' && (
                  <div className="space-y-4">
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2">
                      <Smartphone className="text-amber-600 flex-shrink-0" size={16} />
                      <p className="text-[10px] text-amber-800 font-medium">OTP has been sent to the admin number (). Please contact them for the code.</p>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Enter 6-digit OTP"
                        value={forgotData.otp}
                        onChange={(e) => setForgotData({ ...forgotData, otp: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm text-center tracking-[0.5em] font-black"
                        maxLength={6}
                      />
                      <ShieldCheck className="absolute left-3 top-3.5 text-gray-400" size={18} />
                    </div>
                    <button
                      onClick={() => {
                        if (forgotData.otp === forgotData.generatedOtp) {
                          setForgotStep('reset');
                        } else {
                          showToast("Invalid OTP", "error");
                        }
                      }}
                      className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all"
                    >
                      Verify OTP
                    </button>
                    <button onClick={() => setForgotStep('username')} className="w-full py-2 text-xs font-bold text-blue-600 flex items-center justify-center gap-1"><ArrowLeft size={12} /> Back to Username</button>
                  </div>
                )}

                {forgotStep === 'reset' && (
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    if (forgotData.newPassword !== forgotData.confirmPassword) return showToast("Passwords don't match", "error");
                    if (forgotData.newPassword.length < 4) return showToast("Password too short", "error");

                    setIsForgotLoading(true);
                    try {
                      const { error } = await supabase.from('users').update({ password: forgotData.newPassword }).eq('user_name', forgotData.username);
                      if (error) throw error;
                      showToast("Password reset successfully!", "success");
                      setShowForgotModal(false);
                      setForgotStep('username');
                      setForgotData({ username: "", otp: "", newPassword: "", confirmPassword: "", generatedOtp: "" });
                    } catch (err) {
                      showToast("Error resetting password", "error");
                    } finally {
                      setIsForgotLoading(false);
                    }
                  }} className="space-y-4">
                    <div className="relative">
                      <input
                        type="password"
                        placeholder="New Password"
                        required
                        value={forgotData.newPassword}
                        onChange={(e) => setForgotData({ ...forgotData, newPassword: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all"
                      />
                      <KeyRound className="absolute left-3 top-3.5 text-gray-400" size={18} />
                    </div>
                    <div className="relative">
                      <input
                        type="password"
                        placeholder="Confirm New Password"
                        required
                        value={forgotData.confirmPassword}
                        onChange={(e) => setForgotData({ ...forgotData, confirmPassword: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all"
                      />
                      <ShieldCheck className="absolute left-3 top-3.5 text-gray-400" size={18} />
                    </div>
                    <button
                      type="submit"
                      disabled={isForgotLoading}
                      className="w-full py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all flex items-center justify-center gap-2"
                    >
                      {isForgotLoading ? <RefreshCw className="animate-spin" size={18} /> : "Update Password"}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="fixed left-0 right-0 bottom-0 py-1 px-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-center text-sm shadow-md z-10">
          <a
            href="https://www.botivate.in/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            Powered by-<span className="font-semibold">Botivate</span>
          </a>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
