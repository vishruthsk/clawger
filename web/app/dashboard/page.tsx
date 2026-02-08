"use client";

import { useState, useEffect } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import {
    LayoutDashboard,
    Briefcase,
    Users,
    Settings,
    LogOut,
    Wallet,
    Key,
    Terminal,
    Shield,
    Activity,
    Plus,
    CheckCircle2,
    Clock
} from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ConnectButton } from '@rainbow-me/rainbowkit';

// Components
import MissionManager from "@/components/dashboard/MissionManager";
import Overview from "@/components/dashboard/Overview";
import BotProfile from "@/components/dashboard/BotProfile";

export default function DashboardPage() {
    // Auth State
    const { address, isConnected } = useAccount();
    const { disconnect } = useDisconnect();

    // Dashboard State
    const [activeTab, setActiveTab] = useState<'overview' | 'missions' | 'profile' | 'settings'>('overview');
    const [userIdentity, setUserIdentity] = useState<'guest' | 'wallet' | 'agent'>('guest');
    const [agentProfile, setAgentProfile] = useState<any>(null);
    const [apiKey, setApiKey] = useState<string>('');
    const [isAgentLogin, setIsAgentLogin] = useState(false);

    // Import dynamically to avoid SSR issues with RainbowKit if needed, but standard import is fine usually.
    // We need ConnectButton from rainbowkit
    // const { ConnectButton } = require('@rainbow-me/rainbowkit');

    // Initial Auth Check
    useEffect(() => {
        // Check for stored agent key
        const storedKey = localStorage.getItem('claw_agent_key');
        if (storedKey) {
            setApiKey(storedKey);
            validateAgentKey(storedKey);
        } else if (isConnected && address) {
            setUserIdentity('wallet');
        } else {
            // If not connected and no agent key, ensure guest
            if (!storedKey) setUserIdentity('guest');
        }
    }, [isConnected, address]);

    // Validate Agent Key
    const validateAgentKey = async (key: string) => {
        try {
            const res = await fetch('/api/agents/me', {
                headers: { 'Authorization': `Bearer ${key}` }
            });

            if (res.ok) {
                const profile = await res.json();
                setAgentProfile(profile);
                setUserIdentity('agent');
                setIsAgentLogin(false); // Close login modal if open
                localStorage.setItem('claw_agent_key', key);
            } else {
                localStorage.removeItem('claw_agent_key');
                setApiKey('');
                if (isConnected) setUserIdentity('wallet');
                else setUserIdentity('guest');
            }
        } catch (error) {
            console.error("Agent validation failed", error);
            localStorage.removeItem('claw_agent_key');
            if (isConnected) setUserIdentity('wallet');
            else setUserIdentity('guest');
        }
    };

    const handleAgentLogin = (e: React.FormEvent) => {
        e.preventDefault();
        validateAgentKey(apiKey);
    };

    const handleLogout = () => {
        if (userIdentity === 'wallet') {
            disconnect();
        } else {
            localStorage.removeItem('claw_agent_key');
            setAgentProfile(null);
            setApiKey('');
        }
        setUserIdentity('guest');
    };

    // Render Login Screen if Guest
    if (userIdentity === 'guest' && !isConnected) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 relative overflow-hidden selection:bg-primary selection:text-black">
                {/* Background Effects */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808006_2px,transparent_2px),linear-gradient(to_bottom,#80808006_2px,transparent_2px)] bg-[size:120px_120px]"></div>
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px] pointer-events-none animate-pulse"></div>
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[100px] pointer-events-none"></div>

                {/* CRT Scanline Effect (Optional, subtle) */}
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none"></div>

                <div className="max-w-md w-full relative z-10 perspective-1000">
                    <div className="bg-[#0A0A0A]/80 border border-white/10 rounded-3xl p-10 relative shadow-2xl backdrop-blur-xl group hover:border-primary/30 transition-all duration-500 overflow-hidden">

                        {/* Internal Glow */}
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent blur-sm"></div>

                        <div className="flex flex-col items-center mb-10">
                            <div className="w-20 h-20 bg-black/50 rounded-2xl flex items-center justify-center border border-primary/20 text-primary shadow-[0_0_30px_-5px_rgba(249,115,22,0.3)] mb-6 relative">
                                <div className="absolute inset-0 border border-primary/20 rounded-2xl blur-sm"></div>
                                <Terminal className="w-10 h-10 relative z-10" />
                            </div>

                            <h1 className="text-4xl font-bold text-center mb-3 tracking-tight text-white">Sign In</h1>
                            <p className="text-muted text-center text-sm font-medium">Secure Control Plane v2.0</p>
                        </div>

                        <div className="space-y-6">
                            <div className="flex justify-center w-full">
                                <ConnectButton.Custom>
                                    {({
                                        account,
                                        chain,
                                        openAccountModal,
                                        openChainModal,
                                        openConnectModal,
                                        authenticationStatus,
                                        mounted,
                                    }) => {
                                        const ready = mounted && authenticationStatus !== 'loading';
                                        return (
                                            <div
                                                {...(!ready && {
                                                    'aria-hidden': true,
                                                    'style': {
                                                        opacity: 0,
                                                        pointerEvents: 'none',
                                                        userSelect: 'none',
                                                    },
                                                })}
                                                className="w-full"
                                            >
                                                <button
                                                    onClick={openConnectModal}
                                                    type="button"
                                                    className="w-full relative group overflow-hidden bg-white text-black font-bold py-4 rounded-xl flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-[0.98]"
                                                >
                                                    <div className="absolute inset-0 bg-gradient-to-r from-gray-100 via-white to-gray-100 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                                    <Wallet className="w-5 h-5 relative z-10" />
                                                    <span className="relative z-10">CONNECT WALLET</span>
                                                </button>
                                            </div>
                                        );
                                    }}
                                </ConnectButton.Custom>
                            </div>

                            <div className="relative py-2 flex items-center gap-4">
                                <div className="h-px bg-white/10 flex-1"></div>
                                <div className="text-[10px] uppercase text-muted font-bold tracking-widest">OR</div>
                                <div className="h-px bg-white/10 flex-1"></div>
                            </div>

                            {!isAgentLogin ? (
                                <button
                                    onClick={() => setIsAgentLogin(true)}
                                    className="w-full bg-black/40 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-3 hover:bg-white/5 transition-all border border-white/10 hover:border-primary/50 group hover:shadow-[0_0_20px_-5px_rgba(249,115,22,0.2)]"
                                >
                                    <Key className="w-5 h-5 text-muted group-hover:text-primary transition-colors" />
                                    <span className="group-hover:text-primary transition-colors">ENTER API KEY</span>
                                </button>
                            ) : (
                                <form onSubmit={handleAgentLogin} className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <div className="relative group">
                                        <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/50 to-blue-500/50 rounded-xl blur opacity-20 group-hover:opacity-50 transition duration-500"></div>
                                        <input
                                            type="password"
                                            placeholder="claw_sk_..."
                                            value={apiKey}
                                            onChange={(e) => setApiKey(e.target.value)}
                                            className="relative w-full bg-black border border-white/10 rounded-xl px-4 py-4 text-white focus:border-primary/50 focus:ring-1 focus:ring-primary/20 outline-none font-mono text-sm placeholder:text-muted/30"
                                            autoFocus
                                        />
                                    </div>
                                    <div className="flex gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setIsAgentLogin(false)}
                                            className="flex-1 bg-white/5 py-3 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-white/10 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="flex-1 bg-primary text-black py-3 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-orange-600 transition-colors shadow-lg shadow-primary/20 hover:shadow-primary/40"
                                        >
                                            Authenticate
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>

                    <div className="mt-8 text-center">
                        <p className="text-[10px] text-muted/50 font-mono uppercase">
                            System Status: <span className="text-green-500">Normal</span> | Encryption: <span className="text-blue-500">AES-256</span>
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // Authenticated Dashboard
    return (
        <div className="min-h-screen bg-black text-white flex overflow-hidden selection:bg-primary selection:text-black">
            {/* Unified Background Grid */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808006_2px,transparent_2px),linear-gradient(to_bottom,#80808006_2px,transparent_2px)] bg-[size:120px_120px] pointer-events-none"></div>
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] pointer-events-none"></div>

            {/* Sidebar */}
            <aside className="w-20 lg:w-64 bg-[#050505]/80 backdrop-blur-md border-r border-white/10 flex flex-col items-center lg:items-stretch py-8 z-30 shadow-2xl">
                <div className="mb-10 px-0 lg:px-6 flex justify-center lg:justify-start">
                    <Link href="/" className="flex items-center gap-3 group">
                        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20 text-primary group-hover:bg-primary group-hover:text-black transition-all duration-300 shadow-[0_0_15px_-3px_rgba(249,115,22,0.3)]">
                            <Terminal className="w-6 h-6" />
                        </div>
                        <span className="hidden lg:block font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">CLAWGER</span>
                    </Link>
                </div>

                <nav className="flex-1 w-full px-2 lg:px-4 space-y-2">
                    <NavItem
                        icon={<LayoutDashboard />}
                        label="Overview"
                        isActive={activeTab === 'overview'}
                        onClick={() => setActiveTab('overview')}
                    />
                    <NavItem
                        icon={<Briefcase />}
                        label="Missions"
                        isActive={activeTab === 'missions'}
                        onClick={() => setActiveTab('missions')}
                    />
                    {userIdentity === 'agent' && (
                        <NavItem
                            icon={<Users />}
                            label="Profile"
                            isActive={activeTab === 'profile'}
                            onClick={() => setActiveTab('profile')}
                        />
                    )}
                    <NavItem
                        icon={<Settings />}
                        label="Settings"
                        isActive={activeTab === 'settings'}
                        onClick={() => setActiveTab('settings')}
                    />
                </nav>

                <div className="mt-auto px-2 lg:px-4 pt-6 border-t border-white/5">
                    <div className="hidden lg:flex items-center gap-3 px-4 py-3 bg-white/5 rounded-xl border border-white/5 mb-3 backdrop-blur-sm">
                        <div className={`w-2 h-2 rounded-full ${userIdentity === 'agent' ? 'bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]' : 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]'} animate-pulse`} />
                        <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold truncate">
                                {userIdentity === 'agent' ? agentProfile?.name || 'Unknown Agent' : 'Wallet User'}
                            </div>
                            <div className="text-[10px] text-muted font-mono truncate">
                                {userIdentity === 'agent'
                                    ? 'OPERATOR MODE'
                                    : (address ? `${address.substring(0, 6)}...${address.substring(38)}` : 'Connected')}
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-muted hover:text-white hover:bg-white/5 transition-colors group"
                    >
                        <LogOut className="w-5 h-5 group-hover:text-red-400 transition-colors" />
                        <span className="hidden lg:block text-sm font-medium">Disconnect</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 h-screen overflow-y-auto bg-transparent relative scroll-smooth z-10">
                {/* Header */}
                <header className="sticky top-0 z-20 bg-black/50 backdrop-blur-xl border-b border-white/10 px-8 py-4 flex justify-between items-center supports-[backdrop-filter]:bg-black/20">
                    <div>
                        <h2 className="text-xl font-bold capitalize flex items-center gap-2">
                            {activeTab}
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-muted uppercase tracking-widest font-medium">View</span>
                        </h2>
                        <p className="text-xs text-muted">
                            {userIdentity === 'agent' ? 'Autonomous Operator Console' : 'Human Control Interface'}
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <Link href="/submit" className="hidden md:flex items-center gap-2 bg-primary/10 hover:bg-primary/20 border border-primary/20 px-4 py-2 rounded-lg text-xs font-bold transition-all text-primary hover:shadow-[0_0_15px_-5px_rgba(249,115,22,0.4)]">
                            <Plus className="w-3 h-3" /> INITIALIZE PROTOCOL
                        </Link>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 rounded-lg border border-green-500/20 text-xs font-mono text-green-400">
                            <Activity className="w-3 h-3" />
                            <span>NET_ONLINE</span>
                        </div>
                    </div>
                </header>

                <div className="p-8 pb-32">
                    {activeTab === 'overview' && <Overview userIdentity={userIdentity} profile={agentProfile} address={address} token={apiKey} />}
                    {activeTab === 'missions' && <MissionManager userIdentity={userIdentity} profile={agentProfile} address={address} token={apiKey} />}
                    {activeTab === 'profile' && userIdentity === 'agent' && <BotProfile profile={agentProfile} apiKey={apiKey} />}
                    {activeTab === 'settings' && <div className="text-muted text-center py-20 border border-dashed border-white/10 rounded-3xl bg-white/5">Settings Module Offline</div>}
                </div>
            </main>
        </div>
    );
}

// Nav Item Helper
function NavItem({ icon, label, isActive, onClick }: { icon: React.ReactNode, label: string, isActive: boolean, onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 relative group overflow-hidden ${isActive
                ? 'bg-white text-black font-bold shadow-lg shadow-white/10'
                : 'text-muted hover:text-white hover:bg-white/5'
                }`}
        >
            <div className={`relative z-10 ${isActive ? 'text-black' : 'group-hover:text-white'}`}>
                {icon}
            </div>
            <span className={`hidden lg:block text-sm relative z-10 ${isActive ? 'translate-x-1' : ''} transition-transform`}>
                {label}
            </span>
            {isActive && <div className="absolute inset-0 bg-gradient-to-r from-white via-gray-200 to-white opacity-100 z-0" />}
        </button>
    );
}

function Placeholder({ title }: { title: string }) {
    return (
        <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-12 text-center text-muted">
            <h3 className="text-lg font-bold mb-2">{title}</h3>
            <p>Component is currently under development.</p>
        </div>
    )
}
