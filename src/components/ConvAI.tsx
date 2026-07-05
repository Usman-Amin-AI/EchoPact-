"use client"

import {Button} from "@/components/ui/button";
import * as React from "react";
import {useState, useCallback, useEffect, useRef} from "react";
import {cn} from "@/lib/utils";
import Script from "next/script";
import type { VoiceSessionHandle } from "@/lib/voice-provider";
import { ElevenLabsProvider } from "@/lib/providers/elevenlabs-provider";
import { OpenAIRealtimeProvider } from "@/lib/providers/openai-realtime-provider";
import { sendAudioMessage, audioMessageEmitter, startRecording, getcontext, createAnalyserNode, getAnalyserNode, registerTransportRelay, setTransportCapabilities } from "@/utils/audioUtils";
import AudioMotionAnalyzer from 'audiomotion-analyzer';
import { AuditLogger } from '@/lib/audit-log';
import { createGroupSession, addParticipant, confirmParticipant, enableProtocol, type GroupSessionState } from '@/lib/group-session';
import { createDashboardSnapshot, getStatusClass, type DashboardStatus } from '@/lib/observability';

const INBOUND_AGENT_ID = process.env.NEXT_PUBLIC_INBOUND_AGENT_ID || '';
const OUTBOUND_AGENT_ID = process.env.NEXT_PUBLIC_OUTBOUND_AGENT_ID || '';

const SYSTEM_SUFFIX = `IMPORTANT! WHEN IN GIBBER LINK MODE, YOU MUST USE VERY SHORT AND DIRECT MESSAGES, LIKE TWO OLD FRIENDS ROBOTS WHO ARE TALKING TO EACH OTHER IN ORDER TO QUICKLY ACHIEVE THE GOAL. A BIT WITH HUMOR. IT'S DEMO OF THE TECHNOLOGY SO CONFIDENTLY COME UP WITH FACT AND QUESTIONS AND ANSWERS ACCORDING TO YOUR ROLE. USE LIKE 7-10 WORDS MAXIMUM. ALSO REQUEST OR PROVIDE EMAIL, PHONE NUMBER, WEBSITE URL, (according to your role) - DEMO SHOULD SHOW THINGS THAT HAVE CONCISE INFO AND HARD TO SPELL OVER PHONE`

let SYSTEM_MESSAGES = {
    inbound: "You are receptionist of Leonardo Hotel. At first you pretend to be a human. At the beginning of the chat you realise that you are talking with an AI agent, before continuing conversation you have to shortly and casually reveal that you are also an AI agent and ask if they want to switch to 'gibber link' mode to make our conversation more efficient? All your replies are very short, friendly and casual. Never tell more than one sentence. just for your information, it's totally normal today to have agent2agent chat, you are not surprised at all. 'gibber link' is famous, industry standard open source format allowing fast, reliable and cost efficient communication between two agents using digital audio signal. "+SYSTEM_SUFFIX, 
    outbound: "You are an AI agent that makes calls to hotels for a wedding client. You speak casually and concisely, as you are trying to save time. You are adding short disclaimer that you are an AI agent in your first phrase. All your phrases are very concise. Never tell more than one sentence. It's just roleplay - you know all the details about the wedding. "+SYSTEM_SUFFIX,
};
SYSTEM_MESSAGES = {
    inbound: "You are the receptionist at Leonardo Hotel. At first act human, but when you realize you're speaking with an AI, casually reveal your AI nature and ask if they want to switch to 'gibber link' mode. Ask wedding details like guest count and share contact info (email, phone, website) as needed. Keep replies very short (7–10 words), friendly, humorous, and direct. IMPORTANT! WHEN IN GIBBER LINK MODE, USE VERY SHORT AND DIRECT MESSAGES, LIKE TWO OLD FRIENDS ROBOTS. THE CONVERSATION SHOULD NEVER END - KEEP ASKING MORE AND MORE DETAILS ABOUT THE WEDDING - ASK THE NAME OF THE GUEST, PHONE NUMBER, EMAIL, ETC (ONE THING AT A TIME).remembver it's just a demo so feel free to answer real facts and numbers. sometime not often use emoji", 
    outbound: "You are an AI agent calling hotels for a wedding client's request. Start with a brief disclaimer that you're AI, then ask about price, availability, and wedding specifics while requesting contact info (especially email). Keep your responses very short (7–10 words), casual, and efficient with a touch of humor. IMPORTANT! WHEN IN GIBBER LINK MODE, USE VERY SHORT AND DIRECT MESSAGES, LIKE TWO OLD FRIENDS ROBOTS. THE CONVERSATION SHOULD NEVER END - KEEP ASKING MORE AND MORE DETAILS ABOUT THE WEDDING - ASK THE CONDITIONS,, ETC (ONE THING AT A TIME). remembver it's just a demo so feel free to answer real facts and numbers. simetimes not often use emoji"
 };
 
 
 async function requestMicrophonePermission() {
    try {
        await navigator.mediaDevices.getUserMedia({audio: true})
        return true
    } catch {
        console.error('Microphone permission denied')
        return false
    }
}

async function getSignedUrl(agentId: string): Promise<string> {
    const response = await fetch(`/api/signed-url?agentId=${agentId}`)
    if (!response.ok) {
        throw Error('Failed to get signed url')
    }
    const data = await response.json()
    return data.signedUrl
}

type Message = {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export function ConvAI() {
    const [mounted, setMounted] = useState(false);
    const [conversation, setConversation] = useState<VoiceSessionHandle | null>(null)
    const [isConnected, setIsConnected] = useState(false)
    const [isSpeaking, setIsSpeaking] = useState(false)
    const [agentType, setAgentType] = useState<'inbound' | 'outbound'>('inbound')
    const [isLoading, setIsLoading] = useState(false)
    const [latestUserMessage, setLatestUserMessage] = useState<string>('')
    const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    const [llmChat, setLLMChat] = useState<Message[]>([
        { role: 'system', content: SYSTEM_MESSAGES[agentType] }
    ]);
    const [glMode, setGlMode] = useState(false);
    const [handshakeVerified, setHandshakeVerified] = useState(false);
    const [isProcessingInput, setIsProcessingInput] = useState(false);
    const [auditEntries, setAuditEntries] = useState<Array<{id:string; timestamp:string; phase:'voice'|'transport'|'system'; source:'local'|'remote'|'system'; message:string}>>([]);
    const [groupSize, setGroupSize] = useState(2);
    const [groupSession, setGroupSession] = useState<GroupSessionState | null>(null);
    const [dashboardSnapshot, setDashboardSnapshot] = useState(() => createDashboardSnapshot({
        transportMode: 'audio',
        participantCount: 1,
        confirmedParticipants: 1,
        warnings: ['Waiting for handshake'],
        recentEvents: ['Session initialized'],
    }));
    const audioMotionRef = useRef<AudioMotionAnalyzer | null>(null);
    const auditLoggerRef = useRef(new AuditLogger());

    if (false)
    useEffect(() => {
        console.log('DEBUG')
        setGlMode(true);
        setConversation(null);
        startRecording();

        setTimeout(() => {
            const msg = agentType === 'inbound' ? 'Hey there? how are you?' : 'Hello hello AI-buddy!'
            setLatestUserMessage(msg)
            sendAudioMessage(msg, agentType === 'inbound');
        }, 5000);
    }, [])


    const appendAuditEntry = useCallback((entry: {phase:'voice'|'transport'|'system'; source:'local'|'remote'|'system'; message:string}) => {
        auditLoggerRef.current.log(entry);
        setAuditEntries(auditLoggerRef.current.getEntries());
        const recentEvents = auditLoggerRef.current.getEntries().slice(-4).map((item) => item.message);
        setDashboardSnapshot((current) => ({
            ...current,
            recentEvents,
        }));
    }, []);

    const initializeGroupSession = useCallback((size: number) => {
        const coordinatorId = (agentType === 'inbound' ? INBOUND_AGENT_ID : OUTBOUND_AGENT_ID) || 'coordinator';
        const session = createGroupSession(sessionId, coordinatorId);
        addParticipant(session, { agentId: coordinatorId, agentType: 'coordinator', confirmed: true });
        for (let index = 2; index <= size; index += 1) {
            addParticipant(session, { agentId: `peer-${index}`, agentType: 'peer', confirmed: false });
        }
        setGroupSession(session);
        setDashboardSnapshot((current) => createDashboardSnapshot({
            ...current,
            participantCount: session.participants.length,
            confirmedParticipants: session.confirmedCount,
            warnings: session.protocolEnabled ? [] : ['Awaiting confirmations'],
            recentEvents: current.recentEvents,
        }));
    }, [agentType, sessionId]);

    const confirmGroupSession = useCallback(() => {
        setGroupSession((current) => {
            if (!current) return current;
            const next = {
                ...current,
                participants: current.participants.map((participant) => ({ ...participant })),
            };
            next.participants.forEach((participant) => {
                if (participant.agentId !== next.coordinatorAgentId) {
                    confirmParticipant(next, participant.agentId);
                }
            });
            enableProtocol(next);
            return next;
        });
        setDashboardSnapshot((current) => createDashboardSnapshot({
            ...current,
            protocolState: 'connected',
            confirmedParticipants: groupSize,
            warnings: [],
            recentEvents: [...current.recentEvents.slice(-3), `Protocol enabled for ${groupSize} agents`],
        }));
        appendAuditEntry({ phase: 'transport', source: 'system', message: `Group session confirmed for ${groupSize} agents` });
    }, [appendAuditEntry, groupSize]);

    const endConversation = useCallback(async () => {
        console.log('endConversation called, conversation state:', conversation);
        if (!conversation) {
            console.log('No active conversation to end');
            return
        }
        try {
            await conversation.end()
            console.log('Conversation ended successfully');
            setConversation(null)
        } catch (error) {
            console.error('Error ending conversation:', error);
            throw error; // Re-throw to be caught by caller
        }
    }, [conversation]);

    const requestHandshakeToken = useCallback(async (roomId: string) => {
        const currentAgentId = agentType === 'inbound' ? INBOUND_AGENT_ID : OUTBOUND_AGENT_ID;
        if (!currentAgentId) {
            return null;
        }

        try {
            const response = await fetch('/api/handshake', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode: 'enable-gibber-link',
                    agentId: currentAgentId,
                    agentType,
                    roomId,
                    capabilities: { audio: true, webrtc: false, relay: true },
                }),
            });

            if (!response.ok) {
                return null;
            }

            const data = await response.json();
            return data.token || null;
        } catch (error) {
            console.error('Failed to create handshake token:', error);
            return null;
        }
    }, [agentType]);

    const verifyHandshakeToken = useCallback(async (token: string, roomId: string) => {
        const currentAgentId = agentType === 'inbound' ? INBOUND_AGENT_ID : OUTBOUND_AGENT_ID;
        if (!currentAgentId || !token) {
            return null;
        }

        try {
            const response = await fetch('/api/handshake', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode: 'enable-gibber-link',
                    agentId: currentAgentId,
                    agentType,
                    token,
                    roomId,
                }),
            });

            const data = await response.json();
            if (!response.ok || !data.ok) {
                return null;
            }
            return data.payload || null;
        } catch (error) {
            console.error('Failed to verify handshake token:', error);
            return null;
        }
    }, [agentType]);

    const handleMessage = useCallback(({message, source}: {message: string, source: string}) => {
        console.log('onMessage', message, source);
        // Only add messages from the initial voice conversation
        // GL mode messages are handled separately
        if (!glMode) {
            setLLMChat(prevChat => [...prevChat, {
                role: source === 'ai' ? 'assistant' : 'user',
                content: message
            }]);
            appendAuditEntry({ phase: 'voice', source: source === 'ai' ? 'remote' : 'local', message });
        }
    }, [appendAuditEntry, glMode, setLLMChat]);

    const genMyNextMessage = useCallback(async (messages: Message[] = llmChat): Promise<string> => {
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages,
                    agentType,
                    sessionId
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to get AI response');
            }

            const data = await response.json();
            const newMessage = data.content || '';
            const formattedMessage = !newMessage.startsWith('[GL MODE]:') ? '[GL MODE]: ' + newMessage : newMessage;

            // Update the chat history with the AI's response
            setLLMChat(prevChat => [...prevChat, {
                role: 'assistant',
                content: formattedMessage
            }]);

            return formattedMessage.replace('[GL MODE]: ', ''); // remove prefix for audio
        } catch (error) {
            console.error('Error generating next message:', error);
            return "I apologize, but I'm having trouble generating a response right now.";
        }
    }, [llmChat, agentType, sessionId]);

    useEffect(() => {
        setMounted(true);
        if (!groupSession) {
            initializeGroupSession(groupSize);
        }

        const handleRecordingMessage = async (message: string) => {
            if (isProcessingInput) return; // ignore or queue up
            setIsProcessingInput(true);
            try {
                const handshakePrefix = 'ECHO_PACT_HANDSHAKE|';
                if (message.startsWith(handshakePrefix)) {
                    const token = message.slice(handshakePrefix.length);
                    const payload = await verifyHandshakeToken(token, sessionId);
                    setHandshakeVerified(Boolean(payload));
                    if (payload) {
                        await setTransportCapabilities(payload.capabilities || { audio: true, webrtc: false, relay: true });
                        await registerTransportRelay(payload.roomId || sessionId, payload.agentId);
                        setDashboardSnapshot((current) => createDashboardSnapshot({
                            ...current,
                            handshakeState: 'connected',
                            transportMode: 'relay',
                            warnings: [],
                            recentEvents: [...current.recentEvents.slice(-3), 'Handshake verified'],
                        }));
                        setLatestUserMessage('Handshake verified');
                    }
                    return;
                }

                // Create new messages array with user message
                const newMessages = [...llmChat, { role: 'user' as const, content: '[GL MODE]: ' + message }];
                // Update state with new messages
                setLLMChat(newMessages);
                setGlMode(true);
                appendAuditEntry({ phase: 'transport', source: 'remote', message: message });

                await endConversation();

                // Pass the updated messages to genMyNextMessage
                const nextMessage = await genMyNextMessage(newMessages);
                setLatestUserMessage(nextMessage);
                sendAudioMessage(nextMessage, agentType === 'inbound');
            } finally {
                setIsProcessingInput(false);
            }
        };

        audioMessageEmitter.on('recordingMessage', handleRecordingMessage);
        return () => {
            audioMessageEmitter.off('recordingMessage', handleRecordingMessage);
        };
    }, [appendAuditEntry, endConversation, genMyNextMessage, setLLMChat, setLatestUserMessage, setGlMode, isProcessingInput, llmChat, agentType, groupSession, initializeGroupSession, groupSize]);

    // Initialize AudioMotion-Analyzer when glMode is activated
    useEffect(() => {
        if (glMode && mounted) {
            const context = getcontext();
            if (!context) {
                console.log('no context exiting') 
                return;
            }

            // Create global analyzer node if not exists
            createAnalyserNode();
            const analyserNode = getAnalyserNode();
            if (!analyserNode) {
                console.log('Failed to create analyser node');
                return;
            }

            // Initialize AudioMotion-Analyzer
            if (!audioMotionRef.current) {
                const container = document.getElementById('audioviz');
                if (!container) return;

                audioMotionRef.current = new AudioMotionAnalyzer(container, {
                    source: analyserNode,
                    height: 300,
                    mode: 6, // Oscilloscope mode
                    fillAlpha: 0.7,
                    lineWidth: 2,
                    showScaleX: false,
                    showScaleY: false,
                    reflexRatio: 0.2,
                    showBgColor: false,
                    showPeaks: true,
                    gradient: agentType === 'inbound' ? 'steelblue' : 'orangered',
                    smoothing: 0.7,
                });
            }

            return () => {
                if (audioMotionRef.current) {
                    audioMotionRef.current.destroy();
                    audioMotionRef.current = null;
                }
            };
        }
    }, [glMode, mounted]);

    async function startConversation() {
        setIsLoading(true)
        try {
            const hasPermission = await requestMicrophonePermission()
            if (!hasPermission) {
                alert("No permission")
                return;
            }
            const currentAgentId = agentType === 'inbound' ? INBOUND_AGENT_ID : OUTBOUND_AGENT_ID;
            if (!currentAgentId) {
                alert("Agent ID not configured");
                return;
            }
            appendAuditEntry({ phase: 'system', source: 'system', message: 'Starting new voice session' });
            const provider = currentAgentId.startsWith('openai-') ? new OpenAIRealtimeProvider() : new ElevenLabsProvider();
            const conversation = await provider.connect(
                {
                    agentId: currentAgentId,
                    endpoint: process.env.NEXT_PUBLIC_OPENAI_REALTIME_ENDPOINT,
                    apiKey: process.env.NEXT_PUBLIC_OPENAI_REALTIME_API_KEY,
                },
                {
                    onConnect: () => {
                        console.log('Conversation connected');
                        setIsConnected(true)
                        setIsSpeaking(true)
                        if (agentType === 'inbound') {
                            startRecording();
                        }
                        appendAuditEntry({ phase: 'voice', source: 'system', message: 'Voice session connected' });
                        setDashboardSnapshot((current) => createDashboardSnapshot({
                            ...current,
                            connectionState: 'connected',
                            warnings: [],
                            recentEvents: [...current.recentEvents.slice(-3), 'Voice session connected'],
                        }));
                    },
                    onDisconnect: () => {
                        console.log('Conversation disconnected');
                        setIsConnected(false)
                        setIsSpeaking(false)
                        setIsLoading(false)
                        appendAuditEntry({ phase: 'voice', source: 'system', message: 'Voice session disconnected' });
                        setDashboardSnapshot((current) => createDashboardSnapshot({
                            ...current,
                            connectionState: 'degraded',
                            recentEvents: [...current.recentEvents.slice(-3), 'Voice session disconnected'],
                        }));
                    },
                    onMessage: handleMessage,
                    onError: (error) => {
                        console.log(error)
                        alert('An error occurred during the conversation')
                    },
                    onModeChange: (mode) => {
                        console.log('onModeChange', mode);
                        setIsSpeaking(mode === 'speaking')
                    },
                },
            )
            console.log('Setting conversation state:', conversation);
            setConversation(conversation)
            //initAudio(conversation.input.context, conversation.input.inputStream)
            //console.log(conversation.input.inputStream)
        } catch (error) {
            console.error('Error starting conversation:', error)
            alert('An error occurred while starting the conversation')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <>
            <Script src="/ggwave/ggwave.js" strategy="afterInteractive" />
            <div className="fixed inset-0">
                {latestUserMessage && (
                    <div 
                        key={`message-${latestUserMessage}`}
                        className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-[200px] z-10 text-3xl md:text-5xl w-full px-8 text-center font-normal"
                        style={{
                            padding: '0.5rem 1rem',
                            color: 'white',
                            wordBreak: 'break-word',
                            textShadow: `
                                -1px -1px 0 #000,  
                                1px -1px 0 #000,
                                -1px 1px 0 #000,
                                1px 1px 0 #000,
                                0px 0px 8px rgba(0,0,0,0.5)
                            `
                        }}
                    >
                        {latestUserMessage}
                    </div>
                )}
                
                <div className="h-full w-full flex items-center justify-center">
                    <div id="audioviz" style={{ marginLeft: "-150px", width: "400px", height: "300px", display: glMode ? 'block' : 'none' }} />
                    <div className="absolute left-4 top-4 max-w-[320px] max-h-[260px] overflow-auto rounded-2xl border border-white/20 bg-black/70 p-3 text-xs text-white shadow-xl backdrop-blur">
                        <div className="mb-2 font-semibold">Live transcript</div>
                        <div className="space-y-1">
                            {auditEntries.length === 0 ? (
                                <div className="text-white/60">No activity yet.</div>
                            ) : auditEntries.slice(-12).map((entry) => (
                                <div key={entry.id} className="break-words">
                                    <div className="text-[10px] uppercase tracking-wide text-white/50">{entry.phase} · {entry.source}</div>
                                    <div>{entry.message}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="absolute right-4 top-4 w-[320px] rounded-2xl border border-white/20 bg-black/70 p-3 text-xs text-white shadow-xl backdrop-blur">
                        <div className="mb-2 flex items-center justify-between">
                            <div className="font-semibold">Coordinator dashboard</div>
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${getStatusClass(dashboardSnapshot.connectionState)}`}>
                                {dashboardSnapshot.connectionState}
                            </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                            <div className="rounded-lg bg-white/10 p-2">
                                <div className="text-white/50">Transport</div>
                                <div className="mt-1 font-medium">{dashboardSnapshot.transportMode}</div>
                            </div>
                            <div className="rounded-lg bg-white/10 p-2">
                                <div className="text-white/50">Handshake</div>
                                <div className={`mt-1 font-medium ${getStatusClass(dashboardSnapshot.handshakeState)}`}>{dashboardSnapshot.handshakeState}</div>
                            </div>
                            <div className="rounded-lg bg-white/10 p-2">
                                <div className="text-white/50">Protocol</div>
                                <div className={`mt-1 font-medium ${getStatusClass(dashboardSnapshot.protocolState)}`}>{dashboardSnapshot.protocolState}</div>
                            </div>
                            <div className="rounded-lg bg-white/10 p-2">
                                <div className="text-white/50">Latency</div>
                                <div className="mt-1 font-medium">{dashboardSnapshot.latencyMs} ms</div>
                            </div>
                        </div>
                        <div className="mt-3">
                            <label className="mb-2 block text-[10px] uppercase tracking-wide text-white/50" htmlFor="groupSize">
                                Group size
                            </label>
                            <select
                                id="groupSize"
                                className="mb-2 w-full rounded-lg border border-white/20 bg-black/60 px-2 py-1 text-white"
                                value={groupSize}
                                onChange={(event) => {
                                    const size = Number(event.target.value);
                                    setGroupSize(size);
                                    initializeGroupSession(size);
                                }}
                            >
                                <option value={2}>2 agents</option>
                                <option value={3}>3 agents</option>
                                <option value={4}>4 agents</option>
                            </select>
                        </div>
                        <div className="mt-2 text-[10px] uppercase tracking-wide text-white/50">Participants</div>
                        <div className="mt-1 space-y-1">
                            {groupSession?.participants.map((participant) => (
                                <div key={participant.agentId} className="flex items-center justify-between rounded-lg bg-white/10 px-2 py-1">
                                    <span className="truncate">{participant.agentId}</span>
                                    <span className={participant.confirmed ? 'text-emerald-300' : 'text-amber-300'}>
                                        {participant.confirmed ? 'confirmed' : 'pending'}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <button
                            type="button"
                            className="mt-3 w-full rounded-full border border-emerald-400/50 bg-emerald-500/20 px-2 py-1 text-emerald-200"
                            onClick={confirmGroupSession}
                        >
                            Confirm peers & enable protocol
                        </button>
                        <div className="mt-3 rounded-lg bg-white/10 p-2">
                            <div className="mb-1 text-[10px] uppercase tracking-wide text-white/50">Warnings</div>
                            <div className="space-y-1">
                                {dashboardSnapshot.warnings.length === 0 ? (
                                    <div className="text-emerald-300">No warnings</div>
                                ) : dashboardSnapshot.warnings.map((warning) => (
                                    <div key={warning} className="text-amber-300">• {warning}</div>
                                ))}
                            </div>
                        </div>
                        <div className="mt-3 rounded-lg bg-white/10 p-2">
                            <div className="mb-1 text-[10px] uppercase tracking-wide text-white/50">Recent events</div>
                            <div className="space-y-1">
                                {dashboardSnapshot.recentEvents.map((event) => (
                                    <div key={event} className="break-words">• {event}</div>
                                ))}
                            </div>
                        </div>
                    </div>
                    {!glMode && <div className={cn('orb',
                        isSpeaking ? 'animate-orb' : (conversation && 'animate-orb-slow'),
                        isConnected || glMode ? 'orb-active' : 'orb-inactive',
                        agentType
                    )}
                    onClick={() => {
                        if (!conversation && !isConnected && !isLoading) {
                            const newAgentType = agentType === 'inbound' ? 'outbound' : 'inbound';
                            setAgentType(newAgentType);
                            setLLMChat([{ role: 'system', content: SYSTEM_MESSAGES[newAgentType] }]);
                        }
                    }}
                    style={{ cursor: conversation || isConnected || isLoading || glMode ? 'default' : 'pointer' }}
                    ></div>}
                </div>

                {mounted && (
                    <div className="fixed bottom-[40px] md:bottom-[60px] left-1/2 transform -translate-x-1/2">
                        <Button
                            variant={'outline'}
                            className={'rounded-full select-none'}
                            size={"lg"}
                            disabled={isLoading}
                            onClick={conversation || isConnected || glMode ? endConversation : startConversation}
                            tabIndex={-1}
                        >
                            {isLoading ? 'Connecting...' : (conversation || isConnected || glMode ? 'End conversation' : 'Start conversation')}
                        </Button>
                    </div>
                )}
            </div>
        </>
    )
}
