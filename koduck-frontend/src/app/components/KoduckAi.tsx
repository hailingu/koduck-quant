import { useState } from "react";
import { 
  Send,
} from "lucide-react";
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
    <main className="flex-1 flex flex-col bg-white">
      {/* Top Bar */}
      <header className="border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            {/* Empty - content removed */}
          </div>
          <div className="flex items-center gap-2">
            {/* Empty - content removed */}
          </div>
        </div>
      </header>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="h-full flex flex-col px-4">
          {/* Top spacer - smaller to move content up */}
          <div className="flex-[0.8]"></div>
          
          {/* Centered Input Area */}
          <div className="w-full max-w-3xl mx-auto">
            <h1 className="text-4xl font-normal text-gray-800 text-center mb-12">Hi!</h1>
            
            <div className="relative">
              <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-3xl shadow-sm hover:shadow-md focus-within:shadow-md transition-shadow">
                <button className="p-3 text-gray-400 hover:text-gray-600">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                </button>
                <Input
                  type="text"
                  placeholder="询问问题，尽管问..."
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                  className="flex-1 border-0 bg-transparent focus:outline-none focus-visible:ring-0 focus-visible:border-0 text-base py-4 px-0"
                />
                <button className="p-3 text-gray-400 hover:text-gray-600">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                  </svg>
                </button>
                <button
                  onClick={handleSendMessage}
                  disabled={!chatMessage.trim()}
                  className={`m-2 w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    chatMessage.trim() 
                      ? 'bg-[#10a37f] text-white hover:bg-[#0d8b6d]' 
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
          
          {/* Bottom spacer - larger to move content up */}
          <div className="flex-[2]"></div>
        </div>
      </div>
    </main>
  );
}
