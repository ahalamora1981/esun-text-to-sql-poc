import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, Bot, User, Database, Code2, 
  Terminal, Settings, LayoutPanelLeft, 
  Trash2, HelpCircle, ChevronRight, ChevronDown, 
  TableProperties, AlertCircle, Loader2, Play
} from 'lucide-react';

// --- Mock Data & Simulator ---
// 模拟后端 Agent 的行为，严格遵循 SPEC.md 中的逻辑
const MOCK_TABLES_INFO = `
**数据库中包含以下 7 张表：**
1. \`funds\` (基金基本信息): 包含基金名称、类型、规模、成立日期等。
2. \`companies\` (被投企业信息): 包含企业名称、行业、地区、投资阶段等。
3. \`fund_investments\` (基金投资记录): 包含投资基金、被投企业、投资金额、持股比例等。
4. \`shareholders\` (LP / 股东信息): 包含股东名称、类型、联系人、总认缴金额等。
5. \`fund_shareholders\` (基金-LP 关系): 包含基金、LP、认缴金额、实缴金额、占比等。
6. \`quarterly_reports\` (季度报告数据): 包含基金、年份、季度、总资产管理规模、净值、收益率等。
7. \`financial_statements\` (企业财务数据): 包含企业、年份、季度、营业收入、净利润、总资产等。
`;

const simulateAgentResponse = (input) => {
  const text = input.trim().toLowerCase();

  // 1. 命令处理
  if (text === '/tables') {
    return { role: 'assistant', content: MOCK_TABLES_INFO };
  }
  if (text === '/schema') {
    return {
      role: 'assistant',
      content: "已获取部分核心表结构。",
      metadata: {
        sql: "SELECT sql FROM sqlite_master WHERE type='table';",
        data: [
          { sql: "CREATE TABLE funds (id INTEGER PK, name TEXT NOT NULL, size REAL...)" },
          { sql: "CREATE TABLE companies (id INTEGER PK, name TEXT NOT NULL, industry TEXT...)" }
        ]
      }
    };
  }

  // 2. QuestionGuardMiddleware 拦截模拟
  if (text.includes("天气") || text.includes("笑话") || text.includes("你好")) {
    return {
      role: 'assistant',
      content: "抱歉，我是一个专注于 VC 业务数据的助手。您的问题似乎与风险投资业务无关，我无法为您解答。您可以尝试询问关于基金、被投企业或财务数据的问题。",
      isError: true,
      metadata: { thought: "[QuestionGuard] 判断结果：IRRELEVANT。已拦截请求。" }
    };
  }

  // 3. 正常查询模拟 (匹配 SPEC 示例)
  if (text.includes("星辰") && text.includes("收入")) {
    return {
      role: 'assistant',
      content: "**星辰成长基金**所投资企业在上一季度（2023年Q4）的**总营业收入为 34.5 亿元**人民币。",
      metadata: {
        thought: "[Agent] 用户询问特定基金关联企业的近期收入。需要连接 funds, fund_investments, companies 和 financial_statements 表进行汇总。",
        sql: "SELECT \n  SUM(fs.revenue) as total_revenue \nFROM financial_statements fs \nJOIN companies c ON fs.company_id = c.id \nJOIN fund_investments fi ON c.id = fi.company_id \nJOIN funds f ON fi.fund_id = f.id \nWHERE f.name LIKE '%星辰%' \n  AND fs.year = 2023 AND fs.quarter = 4;",
        data: [ { total_revenue: 34.50 } ]
      }
    };
  }

  if (text.includes("净利润") && text.includes("最高")) {
    return {
      role: 'assistant',
      content: "本季度净利润增长率最高的三家企业分别是：\n1. **云数科技** (增长率 145%)\n2. **星途导航** (增长率 82%)\n3. **绿能新材** (增长率 45%)",
      metadata: {
        thought: "[Agent] 需要查询 financial_statements 表，计算本季度与上季度净利润的差值百分比，并倒序排列取前三。",
        sql: "WITH CurrentQ AS (\n  SELECT company_id, net_income FROM financial_statements WHERE year=2024 AND quarter=1\n), PrevQ AS (\n  SELECT company_id, net_income FROM financial_statements WHERE year=2023 AND quarter=4\n)\nSELECT c.name, ((cq.net_income - pq.net_income) / abs(pq.net_income)) * 100 as growth_rate \nFROM CurrentQ cq \nJOIN PrevQ pq ON cq.company_id = pq.company_id \nJOIN companies c ON cq.company_id = c.id \nORDER BY growth_rate DESC LIMIT 3;",
        data: [
          { name: "云数科技", growth_rate: 145.2 },
          { name: "星途导航", growth_rate: 82.1 },
          { name: "绿能新材", growth_rate: 45.0 }
        ]
      }
    };
  }
  
  if (text.includes("实缴总额") || text.includes("lp")) {
    return {
      role: 'assistant',
      content: "**国盛保险**目前在所有基金中的**实缴总额为 15.0 亿元**。",
      metadata: {
        thought: "[Agent] 提取关键词'实缴总额'，需要查询 fund_shareholders 表，并按股东名称过滤汇总。",
        sql: "SELECT s.name, SUM(fs.paid_in) as total_paid_in\nFROM fund_shareholders fs\nJOIN shareholders s ON fs.shareholder_id = s.id\nWHERE s.name LIKE '%国盛%'\nGROUP BY s.name;",
        data: [ { name: "国盛保险", total_paid_in: 15.0 } ]
      }
    };
  }

  // 默认兜底响应
  return {
    role: 'assistant',
    content: "这是一个演示系统。我理解您查询了关于数据的问题，但未找到精确的预设模拟数据。您可以尝试点击左侧的“快捷提问”来体验完整流程。",
    metadata: {
      thought: "[Agent] 未命中预设场景，返回提示信息。",
      sql: "-- 模拟器未生成 SQL --",
      data: []
    }
  };
};

const INITIAL_MESSAGE = {
  id: 'msg-0',
  role: 'assistant',
  content: "您好！我是 Matrix VC 内部数据助手。您可以向我询问关于基金、被投企业、财务和 LP 数据的任何问题。\n\n💡 **提示：**\n- 开启左下角的 **Debug 模式** 可以查看我背后的 SQL 生成过程和原始数据。\n- 输入 `/tables` 查看数据库结构。\n- 输入 `/clear` 清空对话上下文。"
};

export default function App() {
  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [debugMode, setDebugMode] = useState(true);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async (textOverride) => {
    const text = textOverride || inputValue;
    if (!text.trim()) return;

    const userMsg = { id: `msg-${Date.now()}`, role: 'user', content: text };
    
    if (text === '/clear') {
      setMessages([INITIAL_MESSAGE]);
      setInputValue('');
      return;
    }

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);

    // 模拟网络延迟和 Agent 思考时间
    setTimeout(() => {
      const response = simulateAgentResponse(text);
      setMessages(prev => [...prev, { ...response, id: `msg-${Date.now() + 1}` }]);
      setIsTyping(false);
    }, 1500);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#f8fafc] text-slate-800 font-sans">
      
      {/* --- Sidebar --- */}
      <div className="w-72 bg-slate-900 text-slate-300 flex flex-col shadow-xl z-10 hidden md:flex">
        <div className="p-5 border-b border-slate-800 flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Database size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-slate-100 font-bold text-lg leading-tight">Matrix VC</h1>
            <p className="text-xs text-blue-400 font-medium">Text-to-SQL PoC</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          <div className="px-4 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            测试场景 (Mock)
          </div>
          <div className="space-y-1 px-2">
            {[
              "星辰基金上一季度总收入是多少？",
              "哪些企业本季度净利润增长率最高？",
              "国盛保险的实缴总额是多少？",
              "今天北京天气怎么样？ (测试拦截)"
            ].map((q, i) => (
              <button 
                key={i}
                onClick={() => handleSend(q)}
                className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-slate-800 hover:text-slate-100 transition-colors truncate"
              >
                {q}
              </button>
            ))}
          </div>

          <div className="px-4 mt-8 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            快捷指令
          </div>
          <div className="space-y-1 px-2">
             <button onClick={() => handleSend('/tables')} className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-slate-800 flex items-center gap-2">
                <TableProperties size={14} /> 查看所有表 (/tables)
             </button>
             <button onClick={() => handleSend('/schema')} className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-slate-800 flex items-center gap-2">
                <Code2 size={14} /> 查看表结构 (/schema)
             </button>
             <button onClick={() => handleSend('/clear')} className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-slate-800 flex items-center gap-2 text-red-400 hover:text-red-300">
                <Trash2 size={14} /> 清空会话 (/clear)
             </button>
          </div>
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-950">
          <label className="flex items-center gap-3 cursor-pointer group">
            <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${debugMode ? 'bg-blue-600' : 'bg-slate-600'}`}>
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${debugMode ? 'translate-x-5' : 'translate-x-1'}`} />
            </div>
            <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors flex items-center gap-2">
              <Terminal size={14} />
              开发者模式 (Debug)
            </span>
          </label>
        </div>
      </div>

      {/* --- Main Chat Area --- */}
      <div className="flex-1 flex flex-col h-full bg-white relative">
        {/* Header (Mobile & Simple Info) */}
        <div className="h-14 border-b border-slate-200 flex items-center px-4 justify-between bg-white/80 backdrop-blur-sm z-10">
           <div className="flex items-center gap-2 text-slate-700 font-semibold md:hidden">
              <Database size={18} className="text-blue-600" /> Matrix VC Assistant
           </div>
           <div className="hidden md:flex items-center gap-2 text-sm text-slate-500">
              <span className="flex items-center gap-1.5 bg-green-50 text-green-700 px-2.5 py-1 rounded-full text-xs font-medium border border-green-200">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                数据库已连接 (SQLite)
              </span>
           </div>
           <div className="flex items-center gap-3">
              <button className="text-slate-400 hover:text-slate-600 transition-colors">
                <HelpCircle size={20} />
              </button>
           </div>
        </div>

        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 scroll-smooth">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} debugMode={debugMode} />
          ))}
          {isTyping && (
             <div className="flex gap-4 max-w-3xl animate-pulse">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <Bot size={18} className="text-blue-600" />
                </div>
                <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl rounded-tl-none flex items-center gap-2 text-slate-500 text-sm">
                  <Loader2 size={16} className="animate-spin" />
                  Agent 正在解析语义并生成 SQL...
                </div>
             </div>
          )}
          <div ref={messagesEndRef} className="h-4" />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-slate-100">
          <div className="max-w-4xl mx-auto relative flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-2 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-400 transition-all shadow-sm">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="用自然语言提问，例如：星辰基金上一季度总收入是多少？"
              className="flex-1 max-h-32 min-h-[44px] bg-transparent border-none focus:ring-0 resize-none py-2.5 px-3 text-sm text-slate-700 placeholder:text-slate-400"
              rows={1}
            />
            <button 
              onClick={() => handleSend()}
              disabled={!inputValue.trim() || isTyping}
              className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors shrink-0 mb-0.5"
            >
              <Send size={18} />
            </button>
          </div>
          <div className="max-w-4xl mx-auto mt-2 text-center text-xs text-slate-400">
            通过大模型将自然语言转换为 SQL 查询，数据准确性取决于底层数据库。
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Sub Components ---

const MessageBubble = ({ msg, debugMode }) => {
  const isUser = msg.role === 'user';

  return (
    <div className={`flex gap-4 max-w-4xl mx-auto ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 shadow-sm ${
        isUser ? 'bg-indigo-600 text-white' : (msg.isError ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600')
      }`}>
        {isUser ? <User size={18} /> : (msg.isError ? <AlertCircle size={18} /> : <Bot size={18} />)}
      </div>

      {/* Content Wrapper */}
      <div className={`flex flex-col gap-2 max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Main Text Content */}
        <div className={`p-4 text-[15px] leading-relaxed shadow-sm ${
          isUser 
            ? 'bg-indigo-600 text-white rounded-2xl rounded-tr-none' 
            : (msg.isError 
                ? 'bg-red-50 text-red-800 border border-red-100 rounded-2xl rounded-tl-none'
                : 'bg-white border border-slate-200 text-slate-700 rounded-2xl rounded-tl-none'
              )
        }`}>
          {/* Simple markdown render for bold text */}
          <div dangerouslySetInnerHTML={{ __html: formatText(msg.content) }} />
        </div>

        {/* Debug Info Panels (Only for Assistant && Debug Mode ON && Has Metadata) */}
        {!isUser && debugMode && msg.metadata && (
          <div className="w-full mt-1 space-y-2">
            
            {/* Thought Process */}
            {msg.metadata.thought && (
               <div className="text-xs text-slate-500 flex items-start gap-1.5 px-1 font-mono">
                  <Terminal size={12} className="mt-0.5 shrink-0" />
                  <span className="break-all">{msg.metadata.thought}</span>
               </div>
            )}

            {/* SQL Query */}
            {msg.metadata.sql && (
              <DebugPanel title="Generated SQL" icon={<Code2 size={14} />} colorClass="text-blue-600 bg-blue-50 border-blue-100">
                <pre className="text-xs font-mono text-slate-700 overflow-x-auto p-3 whitespace-pre-wrap">
                  {msg.metadata.sql}
                </pre>
              </DebugPanel>
            )}

            {/* Raw Data Table */}
            {msg.metadata.data && msg.metadata.data.length > 0 && (
              <DebugPanel title="Raw Data Result" icon={<TableProperties size={14} />} colorClass="text-emerald-600 bg-emerald-50 border-emerald-100">
                <div className="overflow-x-auto p-2">
                  <table className="w-full text-left border-collapse text-xs font-mono text-slate-600">
                    <thead>
                      <tr className="border-b border-emerald-200">
                        {Object.keys(msg.metadata.data[0]).map(key => (
                          <th key={key} className="py-2 px-3 font-semibold text-emerald-800 bg-emerald-100/50">{key}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {msg.metadata.data.map((row, i) => (
                        <tr key={i} className="border-b border-emerald-50 last:border-0 hover:bg-emerald-50/50">
                          {Object.values(row).map((val, j) => (
                            <td key={j} className="py-1.5 px-3">{String(val)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </DebugPanel>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const DebugPanel = ({ title, icon, children, colorClass }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className={`rounded-xl border overflow-hidden transition-all duration-200 ${isOpen ? 'shadow-md' : 'shadow-sm'} bg-white`}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold ${colorClass} hover:opacity-80 transition-opacity`}
      >
        <div className="flex items-center gap-2">
          {icon}
          {title}
        </div>
        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {isOpen && (
        <div className="border-t border-slate-100 bg-slate-50">
          {children}
        </div>
      )}
    </div>
  );
}

// Utility to handle simple Markdown (bold and line breaks)
const formatText = (text) => {
  if (!text) return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.*?)`/g, '<code class="bg-slate-100 text-pink-600 px-1 py-0.5 rounded text-sm">$1</code>')
    .replace(/\n/g, '<br/>');
};