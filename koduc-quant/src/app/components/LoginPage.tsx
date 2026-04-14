import { useState } from "react";
import { useNavigate } from "react-router";
import { Mail } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // 模拟登录处理
    setTimeout(() => {
      console.log("Login with:", email, password);
      setIsLoading(false);
      // 登录成功后跳转到主页
      navigate("/");
    }, 1500);
  };

  const handleSocialLogin = (provider: string) => {
    console.log(`Login with ${provider}`);
    // 模拟社交登录成功后跳转
    setTimeout(() => {
      navigate("/");
    }, 1000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-full max-w-md px-8">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-black rounded-lg mb-8">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M22.2819 9.8211C23.1931 9.0888 23.1931 7.7376 22.2819 7.0053L13.7514 0.2679C12.8402 -0.4644 11.6082 -0.0893 11.6082 1.2629V4.9484C5.9467 5.6807 1.5 10.4699 1.5 16.2631C1.5 18.6563 2.2112 20.8681 3.4375 22.7008C4.1487 23.8116 5.7642 23.4365 5.9525 22.1443C6.5225 18.2777 9.5985 15.1486 13.4171 14.4163V18.8523C13.4171 20.2045 14.6491 20.5796 15.5603 19.8473L22.2819 9.8211Z"
                fill="white"
              />
            </svg>
          </div>
          <h1 className="text-3xl mb-2">Welcome back</h1>
          <p className="text-gray-600">Log in to your account to continue</p>
        </div>

        {/* Login Form */}
        <div className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full h-12 px-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#10a37f] focus:border-transparent"
              />
            </div>
            <div>
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full h-12 px-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#10a37f] focus:border-transparent"
              />
            </div>
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 bg-[#10a37f] hover:bg-[#0d8c6d] text-white rounded-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                "Continue"
              )}
            </Button>
          </form>

          <div className="text-center text-sm text-gray-500 py-2">
            Don't have an account?{" "}
            <button
              onClick={() => navigate("/signup")}
              className="text-[#10a37f] hover:underline font-medium"
            >
              Sign up
            </button>
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500">OR</span>
            </div>
          </div>

          {/* Social Login Buttons */}
          <div className="space-y-3">
            <Button
              type="button"
              onClick={() => handleSocialLogin("Google")}
              className="w-full h-12 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-md transition-colors duration-200 flex items-center justify-center gap-3"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path
                  d="M19.8 10.2273C19.8 9.51818 19.7364 8.83636 19.6182 8.18182H10.2V12.05H15.5818C15.3273 13.3 14.5364 14.3591 13.3545 15.0682V17.5773H16.7182C18.7091 15.7364 19.8 13.2273 19.8 10.2273Z"
                  fill="#4285F4"
                />
                <path
                  d="M10.2 20C12.9 20 15.1727 19.1045 16.7182 17.5773L13.3545 15.0682C12.3455 15.6682 11.0909 16.0227 10.2 16.0227C7.59091 16.0227 5.37273 14.1636 4.47727 11.7364H0.990906V14.3318C2.52727 17.3909 6.11364 19.5 10.2 19.5V20Z"
                  fill="#34A853"
                />
                <path
                  d="M4.47727 11.7364C4.25455 11.1364 4.12727 10.4864 4.12727 9.80909C4.12727 9.13182 4.25455 8.48182 4.47727 7.88182V5.28636H0.990906C0.36 6.54091 0 7.94091 0 9.40909C0 10.8773 0.36 12.2773 0.990906 13.5318L4.47727 11.7364Z"
                  fill="#FBBC05"
                />
                <path
                  d="M10.2 3.59545C11.1909 3.59545 12.0682 3.92727 12.7636 4.59091L15.7364 1.61818C14.1682 0.15 12.9 -0.5 10.2 -0.5C6.11364 -0.5 2.52727 1.60909 0.990906 4.66818L4.47727 7.26364C5.37273 4.83636 7.59091 2.97727 10.2 2.97727V3.59545Z"
                  fill="#EA4335"
                />
              </svg>
              Continue with Google
            </Button>

            <Button
              type="button"
              onClick={() => handleSocialLogin("Microsoft")}
              className="w-full h-12 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-md transition-colors duration-200 flex items-center justify-center gap-3"
            >
              <svg width="20" height="20" viewBox="0 0 23 23" fill="none">
                <path d="M0 0h10.931v10.931H0z" fill="#f25022" />
                <path d="M12.069 0H23v10.931H12.069z" fill="#7fba00" />
                <path d="M0 12.069h10.931V23H0z" fill="#00a4ef" />
                <path d="M12.069 12.069H23V23H12.069z" fill="#ffb900" />
              </svg>
              Continue with Microsoft Account
            </Button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-10 text-center text-xs text-gray-500">
          <div className="flex items-center justify-center gap-4">
            <a href="#" className="hover:underline">
              Terms of use
            </a>
            <span>|</span>
            <a href="#" className="hover:underline">
              Privacy policy
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}