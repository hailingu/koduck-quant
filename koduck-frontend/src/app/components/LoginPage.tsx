import { useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { login } from "../auth";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await login({ username, password });
      navigate(from || "/portfolio", { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "登录失败，请稍后重试";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-full max-w-md px-8">
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

        <div className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input
                type="text"
                placeholder="Username or email"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                minLength={3}
                className="w-full h-12 px-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
              />
            </div>

            <div>
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full h-12 px-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
              />
            </div>

            {error ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : null}

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
                "Log in"
              )}
            </Button>
          </form>

          <div className="text-center text-sm text-gray-500 py-2">
            Demo account: <span className="font-medium text-gray-700">demo / demo123</span>
          </div>
        </div>
      </div>
    </div>
  );
}
