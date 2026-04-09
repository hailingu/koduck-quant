import { useState } from "react";
import { Send } from "lucide-react";
import { Input } from "./ui/input";

export function KoduckAi() {
  const [chatMessage, setChatMessage] = useState("");

  const handleSendMessage = () => {
    if (chatMessage.trim()) {
      console.log("Send message:", chatMessage);
      setChatMessage("");
    }
  };

  return (
    <main className="flex-1 flex flex-col bg-white overflow-hidden">
      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="min-h-full flex flex-col items-center justify-start pt-[28vh] px-4">
          {/* Centered Input Area */}
          <div className="w-full max-w-3xl mx-auto">
            <h1 className="text-3xl font-normal text-gray-800 text-center mb-8">
              Hi!
            </h1>

            <div className="relative">
              <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-3xl shadow-sm hover:shadow-md transition-shadow focus-within:shadow-md">
                <button className="p-2.5 text-gray-400 hover:text-gray-600">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
                <Input
                  type="text"
                  placeholder="询问问题，尽管问..."
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                  className="flex-1 border-0 bg-transparent focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:border-0 text-base py-2.5 px-0"
                />
                <button className="p-2.5 text-gray-400 hover:text-gray-600">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  </svg>
                </button>
                <button
                  onClick={handleSendMessage}
                  disabled={!chatMessage.trim()}
                  className={`m-1.5 w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    chatMessage.trim()
                      ? "bg-[#10a37f] text-white hover:bg-[#0d8b6d]"
                      : "bg-gray-200 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}