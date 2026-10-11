import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useElysiaClient } from "@/providers/Eden";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Sparkles,
    Send,
    Loader2,
    Zap,
    Cpu,
    Key,
    Activity,
    CheckCircle2,
    AlertCircle,
    RotateCcw,
    Code2,
    Layers,
    Clock,
    Coins,
} from "lucide-react";

interface ChatMessage {
    role: "user" | "assistant" | "system";
    content: string;
}

interface TelemetryData {
    status: number;
    latencyMs: number;
    model: string;
    provider?: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    creditsDeducted: number;
    rawResponse: any;
}

export function Playground() {
    const elysiaClient = useElysiaClient();
    const queryClient = useQueryClient();

    // Queries for API keys and Models
    const apiKeysQuery = useQuery({
        queryKey: ["api-keys"],
        queryFn: async () => {
            const response = await elysiaClient["api-keys"].get();
            if (response.error) throw new Error("Failed to fetch API keys");
            return response.data;
        },
    });

    const modelsQuery = useQuery({
        queryKey: ["models"],
        queryFn: async () => {
            const response = await elysiaClient.models.get();
            if (response.error) throw new Error("Failed to fetch models");
            return response.data;
        },
    });

    const activeKeys = apiKeysQuery.data?.apiKeys?.filter((k) => !k.disabled) ?? [];
    const models = modelsQuery.data?.models ?? [];

    const [selectedKey, setSelectedKey] = useState<string>("");
    const [selectedModel, setSelectedModel] = useState<string>("");
    const [messages, setMessages] = useState<ChatMessage[]>([
        { role: "assistant", content: "Hello! I'm running through your local LetsRoute router gateway. Select a model and send a prompt to test live routing." }
    ]);
    const [inputPrompt, setInputPrompt] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"chat" | "raw">("chat");

    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-select first key and first model when available
    useEffect(() => {
        if (!selectedKey && activeKeys.length > 0) {
            setSelectedKey(activeKeys[0].apiKey);
        }
    }, [activeKeys, selectedKey]);

    useEffect(() => {
        if (!selectedModel && models.length > 0) {
            setSelectedModel(models[0].slug);
        }
    }, [models, selectedModel]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSendMessage = async () => {
        if (!inputPrompt.trim() || isLoading) return;
        if (!selectedKey) {
            setErrorMsg("Please select or generate an API key first.");
            return;
        }
        if (!selectedModel) {
            setErrorMsg("Please select a model.");
            return;
        }

        setErrorMsg(null);
        const userMsg: ChatMessage = { role: "user", content: inputPrompt.trim() };
        const updatedMessages = [...messages, userMsg];
        setMessages(updatedMessages);
        setInputPrompt("");
        setIsLoading(true);

        const startTime = performance.now();

        try {
            // Send request to the local API router on port 4000
            const response = await fetch("http://localhost:4000/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${selectedKey}`,
                },
                body: JSON.stringify({
                    model: selectedModel,
                    messages: updatedMessages.filter((m) => m.role !== "system" || m.content),
                }),
            });

            const endTime = performance.now();
            const latencyMs = Math.round(endTime - startTime);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || `Request failed with status ${response.status}`);
            }

            const assistantReply = data.completions?.choices?.[0]?.message?.content || "No response received.";
            setMessages((prev) => [...prev, { role: "assistant", content: assistantReply }]);

            setTelemetry({
                status: response.status,
                latencyMs,
                model: selectedModel,
                provider: data.provider || "Auto-routed",
                promptTokens: data.usage?.prompt_tokens ?? data.inputTokensConsumed ?? 0,
                completionTokens: data.usage?.completion_tokens ?? data.outputTokensConsumed ?? 0,
                totalTokens: data.usage?.total_tokens ?? ((data.inputTokensConsumed || 0) + (data.outputTokensConsumed || 0)),
                creditsDeducted: data.usage?.credits_deducted ?? 1,
                rawResponse: data,
            });

            // Invalidate keys and profile to refresh usage metrics in dashboard
            queryClient.invalidateQueries({ queryKey: ["api-keys"] });
            queryClient.invalidateQueries({ queryKey: ["user-profile"] });
        } catch (err: any) {
            console.error("Router error:", err);
            setErrorMsg(err.message || "Failed to complete request through LetsRoute router.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleClearChat = () => {
        setMessages([
            { role: "assistant", content: "Conversation cleared. Ready for a new prompt!" }
        ]);
        setTelemetry(null);
        setErrorMsg(null);
    };

    return (
        <DashboardLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-primary/20 bg-primary/5 text-xs font-medium text-primary mb-2">
                            <Sparkles className="size-3" />
                            Live Router Gateway
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight">API Playground</h1>
                        <p className="text-muted-foreground text-sm mt-1">
                            Test multi-model routing directly against your local <code className="text-primary font-mono text-xs">http://localhost:4000</code> gateway.
                        </p>
                    </div>

                    <Button variant="outline" size="sm" onClick={handleClearChat} className="gap-2">
                        <RotateCcw className="size-3.5" />
                        Reset Session
                    </Button>
                </div>

                {/* Configuration Bar */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="bg-card/50 border-border/50">
                        <CardContent className="pt-4 pb-4">
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="api-key-select" className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground">
                                    <Key className="size-3.5 text-primary" />
                                    Active API Key
                                </Label>
                                {activeKeys.length > 0 ? (
                                    <select
                                        id="api-key-select"
                                        value={selectedKey}
                                        onChange={(e) => setSelectedKey(e.target.value)}
                                        className="h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm shadow-xs focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                                    >
                                        {activeKeys.map((key) => (
                                            <option key={key.id} value={key.apiKey}>
                                                {key.name} ({key.apiKey.slice(0, 10)}...{key.apiKey.slice(-4)})
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <p className="text-xs text-amber-400 mt-1">
                                        No active API keys found. Please create one in the API Keys tab.
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-card/50 border-border/50">
                        <CardContent className="pt-4 pb-4">
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="model-select" className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground">
                                    <Cpu className="size-3.5 text-primary" />
                                    Target Model & Provider
                                </Label>
                                {models.length > 0 ? (
                                    <select
                                        id="model-select"
                                        value={selectedModel}
                                        onChange={(e) => setSelectedModel(e.target.value)}
                                        className="h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm shadow-xs focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                                    >
                                        {models.map((model) => (
                                            <option key={model.id} value={model.slug}>
                                                {model.name} — ({model.slug})
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <p className="text-xs text-muted-foreground mt-1">Loading models catalog...</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Error Banner */}
                {errorMsg && (
                    <div className="flex items-start gap-3 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
                        <AlertCircle className="size-5 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-medium">Gateway Error</p>
                            <p className="text-xs mt-0.5 text-red-300/90">{errorMsg}</p>
                        </div>
                    </div>
                )}

                {/* Main Interactive Studio Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Chat & Prompt Panel (2 Cols) */}
                    <div className="lg:col-span-2 flex flex-col space-y-4">
                        <Card className="bg-card/40 border-border/50 flex-1 flex flex-col min-h-[480px]">
                            <CardHeader className="py-3 px-5 border-b border-border/40 flex flex-row items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Zap className="size-4 text-primary" />
                                    <CardTitle className="text-sm font-semibold">Live Conversation</CardTitle>
                                </div>
                                <div className="flex items-center gap-1.5 text-xs bg-muted/40 p-1 rounded-md">
                                    <button
                                        onClick={() => setActiveTab("chat")}
                                        className={`px-2.5 py-0.5 rounded text-xs font-medium transition-colors ${
                                            activeTab === "chat" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
                                        }`}
                                    >
                                        Chat
                                    </button>
                                    <button
                                        onClick={() => setActiveTab("raw")}
                                        className={`px-2.5 py-0.5 rounded text-xs font-medium transition-colors ${
                                            activeTab === "raw" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
                                        }`}
                                    >
                                        Raw JSON
                                    </button>
                                </div>
                            </CardHeader>

                            <CardContent className="p-5 flex-1 flex flex-col justify-between overflow-hidden">
                                {activeTab === "chat" ? (
                                    <div className="space-y-4 overflow-y-auto max-h-[380px] pr-2">
                                        {messages.map((msg, i) => (
                                            <div
                                                key={i}
                                                className={`flex items-start gap-3 ${
                                                    msg.role === "user" ? "flex-row-reverse" : "flex-row"
                                                }`}
                                            >
                                                <div
                                                    className={`size-7 rounded-lg flex items-center justify-center text-xs shrink-0 font-bold ${
                                                        msg.role === "user"
                                                            ? "bg-primary text-primary-foreground"
                                                            : "bg-primary/10 border border-primary/20 text-primary"
                                                    }`}
                                                >
                                                    {msg.role === "user" ? "U" : <Zap className="size-3.5" />}
                                                </div>

                                                <div
                                                    className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                                                        msg.role === "user"
                                                            ? "bg-primary text-primary-foreground"
                                                            : "bg-muted/40 border border-border/40 text-foreground whitespace-pre-wrap font-sans"
                                                    }`}
                                                >
                                                    {msg.content}
                                                </div>
                                            </div>
                                        ))}

                                        {isLoading && (
                                            <div className="flex items-center gap-3">
                                                <div className="size-7 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center">
                                                    <Loader2 className="size-3.5 animate-spin" />
                                                </div>
                                                <div className="bg-muted/40 border border-border/40 rounded-xl px-4 py-2 text-xs text-muted-foreground flex items-center gap-2">
                                                    <span className="inline-block size-1.5 rounded-full bg-primary animate-pulse" />
                                                    Routing to {selectedModel}...
                                                </div>
                                            </div>
                                        )}
                                        <div ref={messagesEndRef} />
                                    </div>
                                ) : (
                                    <pre className="p-4 rounded-lg bg-background/80 border border-border/50 text-xs font-mono overflow-auto max-h-[380px] text-muted-foreground">
                                        <code>{telemetry ? JSON.stringify(telemetry.rawResponse, null, 2) : "// No completion data recorded yet."}</code>
                                    </pre>
                                )}

                                {/* Input Area */}
                                <div className="mt-4 pt-3 border-t border-border/40 flex items-center gap-2">
                                    <Input
                                        value={inputPrompt}
                                        onChange={(e) => setInputPrompt(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSendMessage();
                                            }
                                        }}
                                        placeholder={`Message ${selectedModel || "model"}...`}
                                        disabled={isLoading}
                                        className="bg-background/60"
                                    />
                                    <Button
                                        onClick={handleSendMessage}
                                        disabled={isLoading || !inputPrompt.trim()}
                                        size="default"
                                        className="shrink-0 gap-2"
                                    >
                                        {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                                        Send
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Telemetry & Metrics Sidebar (1 Col) */}
                    <div className="space-y-4">
                        <Card className="bg-card/40 border-border/50">
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                        <Activity className="size-4 text-emerald-400" />
                                        Router Telemetry
                                    </CardTitle>
                                    <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                                </div>
                                <CardDescription className="text-xs">
                                    Live routing stats for the latest completion.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3.5 text-xs">
                                <div className="flex items-center justify-between p-2 rounded-md bg-muted/30 border border-border/30">
                                    <span className="text-muted-foreground flex items-center gap-1.5">
                                        <Clock className="size-3 text-muted-foreground" />
                                        Latency
                                    </span>
                                    <span className="font-mono font-semibold text-foreground">
                                        {telemetry ? `${telemetry.latencyMs} ms` : "—"}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between p-2 rounded-md bg-muted/30 border border-border/30">
                                    <span className="text-muted-foreground flex items-center gap-1.5">
                                        <Layers className="size-3 text-muted-foreground" />
                                        Routed Provider
                                    </span>
                                    <span className="font-mono font-semibold text-primary">
                                        {telemetry ? telemetry.provider : "—"}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between p-2 rounded-md bg-muted/30 border border-border/30">
                                    <span className="text-muted-foreground flex items-center gap-1.5">
                                        <Code2 className="size-3 text-muted-foreground" />
                                        Prompt Tokens
                                    </span>
                                    <span className="font-mono font-semibold text-foreground">
                                        {telemetry ? telemetry.promptTokens : "—"}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between p-2 rounded-md bg-muted/30 border border-border/30">
                                    <span className="text-muted-foreground flex items-center gap-1.5">
                                        <Code2 className="size-3 text-muted-foreground" />
                                        Output Tokens
                                    </span>
                                    <span className="font-mono font-semibold text-foreground">
                                        {telemetry ? telemetry.completionTokens : "—"}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between p-2 rounded-md bg-primary/5 border border-primary/20">
                                    <span className="text-muted-foreground flex items-center gap-1.5">
                                        <Coins className="size-3.5 text-primary" />
                                        Credits Deducted
                                    </span>
                                    <span className="font-mono font-bold text-primary">
                                        {telemetry ? `-${telemetry.creditsDeducted} credits` : "—"}
                                    </span>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Quick cURL Generator Card */}
                        <Card className="bg-card/40 border-border/50">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground">
                                    <Code2 className="size-3.5" />
                                    cURL Equivalent
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <pre className="p-3 rounded-md bg-background/90 border border-border/50 text-[11px] font-mono leading-relaxed overflow-x-auto text-muted-foreground">
                                    <code>{`curl http://localhost:4000/api/v1/chat/completions \\
  -H "Authorization: Bearer ${selectedKey ? selectedKey.slice(0, 12) + "..." : "YOUR_API_KEY"}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${selectedModel || "google/gemini-2.0-flash"}",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`}</code>
                                </pre>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
