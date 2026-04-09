import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import { Input } from "./ui/input";

type MessageType = "text" | "card";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  type: MessageType;
  timestamp: number;
  cardData?: {
    title: string;
    description: string;
    value?: string;
    change?: string;
  };
}

export function KoduckAi() {
  const [chatMessage, setChatMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = () => {
    if (chatMessage.trim()) {
      const userMessage: Message = {
        id: Date.now().toString(),
        role: "user",
        content: chatMessage,
        type: "text",
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setChatMessage("");

      setTimeout(() => {
        const aiResponse: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: getAIResponse(chatMessage),
          type: shouldReturnCard(chatMessage) ? "card" : "text",
          timestamp: Date.now(),
          cardData: shouldReturnCard(chatMessage)
            ? generateCardData(chatMessage)
            : undefined,
        };
        setMessages((prev) => [...prev, aiResponse]);
      }, 500);
    }
  };

  const getAIResponse = (message: string): string => {
    const lower = message.toLowerCase();
    if (lower.includes("分析") || lower.includes("数据")) {
      return "我已经为您生成了相关的数据分析卡片。";
    }
    return "这是一个示例回复。您可以询问关于量化交易、投资组合或市场分析的问题。";
  };

  const shouldReturnCard = (message: string): boolean => {
    const lower = message.toLowerCase();
    return (
      lower.includes("分析") ||
      lower.includes("数据") ||
      lower.includes("portfolio") ||
      lower.includes("股票")
    );
  };

  const generateCardData = (message: string) => {
    return {
      title: "AAPL - Apple Inc.",
      description: "科技板块 · 纳斯达克",
      value: "$175.43",
      change: "+2.34%",
    };
  };

  const formatTimestamp = (timestamp: number): string => {
    if (!timestamp) {
      return (
        new Date().toLocaleString("zh-CN", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }) +
        "." +
        new Date().getMilliseconds().toString().padStart(3, "0")
      );
    }
    const date = new Date(timestamp);
    const dateStr = date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const ms = date.getMilliseconds().toString().padStart(3, "0");
    return `${dateStr}.${ms}`;
  };

  const renderInputBar = () => (
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
  );

  return (
    <main className="flex-1 flex flex-col bg-white overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div
          className={`min-h-full flex flex-col ${
            messages.length === 0
              ? "items-center justify-start pt-[28vh]"
              : "justify-start pt-8"
          } px-4`}
        >
          {messages.length === 0 ? (
            <div className="w-full max-w-3xl mx-auto">
              <h1 className="text-3xl font-normal text-gray-800 text-center mb-8">
                Hi!
              </h1>
              {renderInputBar()}
            </div>
          ) : (
            <div className="w-full max-w-3xl mx-auto space-y-6 mb-32">
              {messages.map((message) => (
                <div key={message.id} className="space-y-2">
                  <div
                    className={`flex ${
                      message.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[80%] ${
                        message.role === "user"
                          ? "bg-gray-100 rounded-3xl px-5 py-3"
                          : ""
                      }`}
                    >
                      {message.type === "text" ? (
                        <p
                          className={`text-base ${
                            message.role === "user"
                              ? "text-gray-900"
                              : "text-gray-800"
                          }`}
                        >
                          {message.content}
                        </p>
                      ) : (
                        <div>
                          <p className="text-base text-gray-800 mb-4">
                            {message.content}
                          </p>
                          {message.cardData && (
                            <div className="bg-white rounded-2xl p-5 hover:bg-gray-50 transition-colors cursor-pointer">
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <h3 className="text-lg font-medium text-gray-900">
                                    {message.cardData.title}
                                  </h3>
                                  <p className="text-sm text-gray-500">
                                    {message.cardData.description}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-baseline gap-2 mt-3">
                                <span className="text-2xl font-medium text-gray-900">
                                  {message.cardData.value}
                                </span>
                                <span
                                  className={`text-sm font-medium ${
                                    message.cardData.change?.startsWith("+")
                                      ? "text-[#10a37f]"
                                      : "text-red-500"
                                  }`}
                                >
                                  {message.cardData.change}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div
                    className={`flex ${
                      message.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div className="bg-gray-100 text-gray-600 text-xs px-3 py-1 rounded-full">
                      {formatTimestamp(message.timestamp)}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      <div className={`bg-white ${messages.length === 0 ? "hidden" : ""}`}>
        <div className="w-full max-w-3xl mx-auto px-4 py-4">{renderInputBar()}</div>
      </div>
    </main>
  );
}
