import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  LinearProgress,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import { createChat, getChat, listChats, sendMessage } from "../lib/api";
import type { Chat, Message } from "../types";
import { useAuthStore } from "../store/auth";

interface ParsedAssistantPayload {
  response_type?: string;
  message?: string;
  [key: string]: unknown;
}

function parseAssistantPayload(content: string): ParsedAssistantPayload | null {
  try {
    const parsed = JSON.parse(content) as unknown;
    if (parsed && typeof parsed === "object") {
      return parsed as ParsedAssistantPayload;
    }
    return null;
  } catch {
    return null;
  }
}

interface ScoreCardData {
  projected_revenue_by_territory?: Record<string, number>;
  risk_flags?: Array<{
    category: string;
    severity: string;
    scene_ref?: string;
    source_ref?: string;
    mitigation?: string;
    confidence?: number;
  }>;
  recommended_acquisition_price?: number;
  release_timeline?: {
    release_mode?: string;
    theatrical_window_days?: number;
  };
  marketing_spend_usd?: number;
  platform_priority?: string[];
  roi_scenarios?: Record<string, number>;
  citations?: Array<{
    source_path?: string;
    doc_id?: string;
    page?: number | null;
    excerpt?: string;
  }>;
  confidence?: number;
  warnings?: string[];
  evidence_basis?: string;
  degraded_mode?: { enabled?: boolean; reason_code?: string | null };
  [key: string]: unknown;
}

function ScoreCardView({ data }: { data: ScoreCardData }) {
  const [showCitations, setShowCitations] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  const fmt = (n?: number) =>
    n != null ? `$${(n / 1_000_000).toFixed(2)}M` : "—";
  const pct = (n?: number) =>
    n != null ? `${Math.round(n * 100)}%` : "—";
  const severityColor = (s: string): "error" | "warning" | "success" =>
    s === "HIGH" ? "error" : s === "MEDIUM" ? "warning" : "success";

  const territory = Object.keys(data.projected_revenue_by_territory ?? {})[0] ?? "—";
  const totalRevenue = Object.values(data.projected_revenue_by_territory ?? {})[0];
  const conf = data.confidence ?? 0;
  const confColor = conf >= 0.7 ? "success" : conf >= 0.45 ? "warning" : "error";

  return (
    <Box sx={{ width: "100%", maxWidth: 600 }}>
      {data.degraded_mode?.enabled && (
        <Alert severity="warning" sx={{ mb: 1, fontSize: "0.8rem" }}>
          Benchmark-derived estimate — limited market data
          {data.degraded_mode.reason_code ? ` (${data.degraded_mode.reason_code})` : ""}
        </Alert>
      )}
      {(data.warnings ?? []).map((w, i) => (
        <Alert severity="info" sx={{ mb: 1, fontSize: "0.75rem" }} key={i}>
          {w}
        </Alert>
      ))}

      {/* Revenue & Acquisition */}
      <Card sx={{ mb: 1.5 }}>
        <CardContent sx={{ pb: "12px !important" }}>
          <Typography variant="overline" color="text.secondary" fontSize="0.65rem">
            {territory} — Revenue Forecast
          </Typography>
          <Stack direction="row" spacing={3} mt={0.5} flexWrap="wrap">
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">Total Revenue</Typography>
              <Typography variant="h6" fontSize="1.1rem">{fmt(totalRevenue)}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">Recommended MG</Typography>
              <Typography variant="h6" fontSize="1.1rem">{fmt(data.recommended_acquisition_price)}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">Marketing Budget</Typography>
              <Typography variant="h6" fontSize="1.1rem">{fmt(data.marketing_spend_usd)}</Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {/* Confidence bar */}
      <Box sx={{ mb: 1.5 }}>
        <Stack direction="row" justifyContent="space-between" mb={0.5}>
          <Typography variant="caption" color="text.secondary">
            Confidence —{" "}
            {data.evidence_basis === "grounded" ? "Market-grounded" : "Benchmark-derived"}
          </Typography>
          <Typography variant="caption">{pct(data.confidence)}</Typography>
        </Stack>
        <LinearProgress variant="determinate" value={conf * 100} color={confColor} />
      </Box>

      {/* Release strategy */}
      <Card sx={{ mb: 1.5 }}>
        <CardContent sx={{ pb: "12px !important" }}>
          <Typography variant="overline" color="text.secondary" fontSize="0.65rem">
            Release Strategy
          </Typography>
          <Stack direction="row" spacing={1.5} mt={0.5} flexWrap="wrap" alignItems="center">
            <Chip
              label={(data.release_timeline?.release_mode ?? "theatrical_first").replace(/_/g, " ")}
              color={(data.release_timeline?.release_mode ?? "").includes("streaming") ? "secondary" : "primary"}
              size="small"
            />
            {(data.release_timeline?.theatrical_window_days ?? 0) > 0 && (
              <Typography variant="body2" color="text.secondary">
                {data.release_timeline?.theatrical_window_days}d window
              </Typography>
            )}
          </Stack>
          {(data.platform_priority ?? []).length > 0 && (
            <Stack direction="row" spacing={0.75} mt={1} flexWrap="wrap">
              {(data.platform_priority ?? []).map((p, i) => (
                <Chip key={i} label={p} size="small" variant="outlined" />
              ))}
            </Stack>
          )}
          {Object.keys(data.roi_scenarios ?? {}).length > 0 && (
            <Box mt={1}>
              <Typography variant="caption" color="text.secondary">ROI Scenarios</Typography>
              <Stack direction="row" spacing={2} mt={0.25} flexWrap="wrap">
                {Object.entries(data.roi_scenarios ?? {}).map(([name, val]) => (
                  <Box key={name}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {name.replace(/_/g, " ")}
                    </Typography>
                    <Typography variant="body2" fontWeight="medium">{pct(val)}</Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Risk flags */}
      {(data.risk_flags ?? []).length > 0 && (
        <Card sx={{ mb: 1.5 }}>
          <CardContent sx={{ pb: "12px !important" }}>
            <Typography variant="overline" color="text.secondary" fontSize="0.65rem">
              Risk Flags
            </Typography>
            <Stack spacing={0.75} mt={0.5}>
              {(data.risk_flags ?? []).map((flag, i) => (
                <Box key={i} display="flex" alignItems="flex-start" gap={1}>
                  <Chip
                    label={flag.severity}
                    color={severityColor(flag.severity)}
                    size="small"
                    sx={{ minWidth: 58, mt: 0.15 }}
                  />
                  <Box>
                    <Typography variant="body2" fontWeight="medium" fontSize="0.83rem">
                      {flag.category.replace(/_/g, " ")}
                    </Typography>
                    {flag.mitigation && (
                      <Typography variant="caption" color="text.secondary">
                        {flag.mitigation}
                      </Typography>
                    )}
                  </Box>
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Citations */}
      {(data.citations ?? []).length > 0 && (
        <Box sx={{ mb: 0.75 }}>
          <Button
            size="small"
            variant="text"
            onClick={() => setShowCitations(!showCitations)}
            sx={{ p: 0, textTransform: "none", color: "text.secondary", fontSize: "0.75rem" }}
          >
            {showCitations ? "Hide" : "Show"} {(data.citations ?? []).length} source
            {(data.citations ?? []).length !== 1 ? "s" : ""}
          </Button>
          {showCitations && (
            <Box mt={0.75} pl={1.5} borderLeft="2px solid" borderColor="divider">
              {(data.citations ?? []).slice(0, 8).map((c, i) => (
                <Box key={i} sx={{ mb: 0.75 }}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {c.doc_id ?? c.source_path}
                    {c.page != null ? ` — p.${c.page}` : ""}
                  </Typography>
                  {c.excerpt && (
                    <Typography variant="caption" color="text.primary">
                      {c.excerpt.slice(0, 180)}…
                    </Typography>
                  )}
                </Box>
              ))}
            </Box>
          )}
        </Box>
      )}

      {/* Raw JSON toggle */}
      <Button
        size="small"
        variant="text"
        onClick={() => setShowRaw(!showRaw)}
        sx={{ p: 0, textTransform: "none", color: "text.disabled", fontSize: "0.68rem" }}
      >
        {showRaw ? "Hide" : "View"} raw JSON
      </Button>
      {showRaw && (
        <Typography
          variant="body2"
          component="pre"
          sx={{
            mt: 0.5,
            fontSize: "0.62rem",
            whiteSpace: "pre-wrap",
            fontFamily: "monospace",
            color: "text.secondary",
          }}
        >
          {JSON.stringify(data, null, 2)}
        </Typography>
      )}
    </Box>
  );
}

function ChatPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);

  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeChatId = useMemo(() => (chatId ? Number(chatId) : null), [chatId]);

  useEffect(() => {
    const loadChats = async () => {
      setLoading(true);
      try {
        const data = await listChats();
        setChats(data);
        if (!activeChatId && data.length > 0) {
          navigate(`/chat/${data[0].id}`, { replace: true });
        }
      } catch {
        setError("Failed to load chats.");
      } finally {
        setLoading(false);
      }
    };

    void loadChats();
  }, [activeChatId, navigate]);

  useEffect(() => {
    const loadChatDetail = async () => {
      if (!activeChatId) {
        setMessages([]);
        return;
      }

      setLoading(true);
      try {
        const chat = await getChat(activeChatId);
        setMessages(chat.messages);
      } catch {
        setError("Failed to load chat history.");
      } finally {
        setLoading(false);
      }
    };

    void loadChatDetail();
  }, [activeChatId]);

  const handleNewChat = async () => {
    setError(null);
    try {
      const created = await createChat("New Chat");
      setChats((prev) => [created, ...prev]);
      navigate(`/chat/${created.id}`);
    } catch {
      setError("Unable to create chat.");
    }
  };

  const handleSend = async () => {
    if (!input.trim()) {
      return;
    }
    setSending(true);
    setError(null);

    try {
      let targetChatId = activeChatId;
      if (!targetChatId) {
        const created = await createChat("New Chat");
        setChats((prev) => [created, ...prev]);
        targetChatId = created.id;
        navigate(`/chat/${created.id}`);
      }

      const newMessages = await sendMessage(targetChatId, input.trim());
      setMessages((prev) => [...prev, ...newMessages]);
      setInput("");
    } catch {
      setError("Unable to send message.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Box display="flex" height="100vh">
      <Box
        width={280}
        borderRight="1px solid"
        borderColor="divider"
        padding={2}
        display="flex"
        flexDirection="column"
        gap={2}
      >
        <Stack spacing={0.5}>
          <Typography variant="h6">MarketLogic AI</Typography>
          <Typography variant="body2" color="text.secondary">
            {user?.full_name ?? user?.username}
          </Typography>
        </Stack>
        <Button variant="contained" onClick={handleNewChat}>
          New Chat
        </Button>
        <Divider />
        <Box flex={1} overflow="auto">
          <List disablePadding>
            {chats.map((chat) => (
              <ListItemButton
                key={chat.id}
                selected={chat.id === activeChatId}
                onClick={() => navigate(`/chat/${chat.id}`)}
              >
                <ListItemText primary={chat.title} secondary={`#${chat.id}`} />
              </ListItemButton>
            ))}
            {chats.length === 0 && (
              <Typography color="text.secondary" padding={1}>
                No chats yet.
              </Typography>
            )}
          </List>
        </Box>
        <Button variant="text" color="inherit" onClick={logout}>
          Logout
        </Button>
      </Box>

      <Box flex={1} display="flex" flexDirection="column" padding={3} gap={2}>
        <Box flex={1} overflow="auto" display="flex" flexDirection="column" gap={2}>
          {loading && <Typography color="text.secondary">Loading...</Typography>}
          {error && <Typography color="error">{error}</Typography>}
          {messages.map((message) => (
            <Box
              key={message.id}
              alignSelf={message.role === "user" ? "flex-end" : "flex-start"}
              maxWidth="70%"
            >
              <Box
                padding={2}
                borderRadius={2}
                bgcolor={message.role === "user" ? "primary.main" : "grey.900"}
                color={message.role === "user" ? "primary.contrastText" : "grey.100"}
              >
                {message.role === "assistant" ? (
                  (() => {
                    const payload = parseAssistantPayload(message.content);
                    if (!payload) {
                      return <Typography variant="body1">{message.content}</Typography>;
                    }
                    if (payload.response_type === "scorecard_response") {
                      return <ScoreCardView data={payload as ScoreCardData} />;
                    }
                    return <Typography variant="body1">{String(payload.message ?? message.content)}</Typography>;
                  })()
                ) : (
                  <Typography variant="body1">{message.content}</Typography>
                )}
              </Box>
            </Box>
          ))}
          {messages.length === 0 && !loading && (
            <Typography color="text.secondary">
              Start a new evaluation by sharing the film logline and key metrics.
            </Typography>
          )}
        </Box>
        <Stack direction="row" spacing={2}>
          <TextField
            fullWidth
            placeholder="Ask MarketLogic about a film..."
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void handleSend();
              }
            }}
          />
          <Button variant="contained" onClick={handleSend} disabled={sending}>
            {sending ? "Sending..." : "Send"}
          </Button>
        </Stack>
      </Box>
    </Box>
  );
}

export default ChatPage;
