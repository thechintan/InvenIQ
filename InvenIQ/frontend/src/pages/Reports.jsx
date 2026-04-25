import { useState } from 'react';
import api from '../api/axios';
import { Bot, Send, Table, MessageSquare, Sparkles, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Reports() {
  const [question, setQuestion] = useState('');
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(false);

  const exampleQueries = [
    'Which products in all warehouses are below their reorder level?',
    'Show me all stock-out transactions from last week above 50 units',
    'Which product had the most returns this month?',
    'What is the total stock value across all warehouses?',
    'List all products in the Electronics category with less than 50 units',
    'Show me the top 5 suppliers by number of products',
    'How many orders are pending dispatch?',
    'What is the average order value this month?',
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!question.trim()) return;

    const q = question.trim();
    setConversations(prev => [...prev, { type: 'question', text: q }]);
    setQuestion('');
    setLoading(true);

    try {
      const res = await api.post('/ai/nl-query', { question: q });
      const data = res.data.data;
      setConversations(prev => [...prev, { type: 'answer', data }]);
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Failed to process query';
      setConversations(prev => [...prev, { type: 'error', text: errMsg }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">AI Assistant</h1><p className="page-subtitle">Ask questions about your inventory in plain English</p></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Chat area */}
        <div className="lg:col-span-3">
          <div className="card flex flex-col" style={{ height: 'calc(100vh - 220px)' }}>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {conversations.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="w-16 h-16 rounded-2xl bg-primary-50 flex items-center justify-center mb-4">
                    <Bot className="w-8 h-8 text-primary-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">Ask me anything about your inventory</h3>
                  <p className="text-sm text-slate-400 max-w-md">I'll convert your question into a database query and show you the results. Try asking about stock levels, orders, alerts, or any data in your system.</p>
                </div>
              )}

              {conversations.map((msg, i) => (
                <div key={i} className={`fade-up ${msg.type === 'question' ? 'flex justify-end' : ''}`}>
                  {msg.type === 'question' && (
                    <div className="bg-primary-500 text-white rounded-2xl rounded-tr-sm px-4 py-3 max-w-lg">
                      <p className="text-sm">{msg.text}</p>
                    </div>
                  )}
                  {msg.type === 'answer' && (
                    <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm p-4 max-w-4xl">
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="w-4 h-4 text-purple-500" />
                        <span className="text-xs font-medium text-purple-600">AI Response</span>
                        <span className="text-xs text-slate-400">({msg.data.row_count} rows)</span>
                      </div>
                      {msg.data.results?.length > 0 ? (
                        <div className="overflow-x-auto rounded-lg border border-slate-200">
                          <table className="w-full text-xs">
                            <thead className="bg-slate-50">
                              <tr>{msg.data.columns?.map(col => <th key={col} className="px-3 py-2 text-left font-semibold text-slate-600 uppercase tracking-wider">{col.replace(/_/g, ' ')}</th>)}</tr>
                            </thead>
                            <tbody>
                              {msg.data.results.slice(0, 20).map((row, ri) => (
                                <tr key={ri} className="border-t border-slate-100 hover:bg-slate-50">
                                  {msg.data.columns?.map(col => (
                                    <td key={col} className="px-3 py-2 text-slate-700 whitespace-nowrap">{row[col]?.toString() || '-'}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {msg.data.results.length > 20 && <p className="px-3 py-2 text-xs text-slate-400 border-t">Showing 20 of {msg.data.results.length} results</p>}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500">No results found for this query.</p>
                      )}
                      <details className="mt-2">
                        <summary className="text-[10px] text-slate-400 cursor-pointer hover:text-slate-600">View SQL</summary>
                        <pre className="mt-1 p-2 bg-slate-900 text-green-400 rounded-lg text-[11px] overflow-x-auto">{msg.data.sql}</pre>
                      </details>
                    </div>
                  )}
                  {msg.type === 'error' && (
                    <div className="bg-red-50 border border-red-200 rounded-2xl rounded-tl-sm p-4 max-w-lg">
                      <p className="text-sm text-red-700">{msg.text}</p>
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div className="flex items-center gap-2 text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Analyzing your question...</span>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="border-t border-slate-200 p-4">
              <form onSubmit={handleSubmit} className="flex gap-3">
                <input className="input-field flex-1" placeholder="Ask a question about your inventory..."
                       value={question} onChange={e => setQuestion(e.target.value)} disabled={loading} />
                <button type="submit" disabled={loading || !question.trim()} className="btn-primary px-5">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Example queries */}
        <div className="card p-5 h-fit">
          <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary-500" /> Example Questions
          </h3>
          <div className="space-y-2">
            {exampleQueries.map((q, i) => (
              <button key={i} onClick={() => setQuestion(q)}
                      className="w-full text-left p-3 rounded-lg text-xs text-slate-600 hover:bg-primary-50 hover:text-primary-700 transition-colors border border-slate-100">
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
