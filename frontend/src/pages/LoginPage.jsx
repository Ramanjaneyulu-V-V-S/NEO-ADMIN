import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, Loader2, ArrowRight, Mail, Eye, EyeOff } from 'lucide-react';
import api from '../api/axios';
import nabardLogo from '../assets/nabard-logo.svg';
import usePrefersReducedMotion from '../hooks/usePrefersReducedMotion';
import { EASE_SMOOTH } from '../utils/motion';

// Determine repository based on environment
const getDefaultRepository = () => {
    // Check for explicit environment variable first
    if (import.meta.env.VITE_DCTM_REPOSITORY) {
        return import.meta.env.VITE_DCTM_REPOSITORY;
    }

    // Check hostname to determine environment
    const hostname = window.location.hostname.toLowerCase();

    // Production: use EDMS (exact match first)
    if (hostname === 'neo.nabard.org' || hostname.endsWith('.neo.nabard.org')) {
        return 'EDMS';
    }

    // UAT: use NABARDUAT (exact match first)
    if (hostname === 'ecmrevampuat.nabard.org' || hostname.endsWith('.ecmrevampuat.nabard.org')) {
        return 'NABARDUAT';
    }

    // Azure: use NABARDUAT
    if (hostname === '172.172.20.214' || hostname.includes('172.172.20.214') || hostname.includes('azure')) {
        return 'NABARDUAT';
    }

    // Check for environment keywords as fallback
    if (hostname.includes('production') || hostname.includes('prod')) {
        return 'EDMS';
    }

    if (hostname.includes('uat') || hostname.includes('test')) {
        return 'NABARDUAT';
    }

    // Local/default: NABARDUAT
    return 'NABARDUAT';
};

// Determine OTDS URL based on environment
const getOtdsUrl = () => {
    // Check for explicit environment variable first (highest priority)
    if (import.meta.env.VITE_OTDS_URL) {
        return import.meta.env.VITE_OTDS_URL;
    }

    // Check hostname to determine environment
    const hostname = window.location.hostname.toLowerCase();

    // Production: neo.nabard.org (check with exact match first)
    if (hostname === 'neo.nabard.org' || hostname.endsWith('.neo.nabard.org')) {
        const url = 'https://neo.nabard.org/proxy/otds/Integration/otds-proxy/token';
        return url;
    }

    // UAT: ecmrevampuat.nabard.org (check with exact match first)
    if (hostname === 'ecmrevampuat.nabard.org' || hostname.endsWith('.ecmrevampuat.nabard.org')) {
        const url = 'https://ecmrevampuat.nabard.org/proxy/otds/Integration/otds-proxy/token';
        return url;
    }

    // Azure: IP-based or contains 'azure'
    if (hostname === '172.172.20.214' || hostname.includes('172.172.20.214') || hostname.includes('azure')) {
        const url = 'http://172.172.20.214/proxy/otds/Integration/otds-proxy/token';
        return url;
    }

    // Check for environment keywords as fallback
    if (hostname.includes('production') || hostname.includes('prod')) {
        const url = 'https://neo.nabard.org/proxy/otds/Integration/otds-proxy/token';
        return url;
    }

    if (hostname.includes('uat') || hostname.includes('test')) {
        const url = 'https://ecmrevampuat.nabard.org/proxy/otds/Integration/otds-proxy/token';
        return url;
    }

    // Local/default: use Azure IP for development
    const url = 'http://172.172.20.214/proxy/otds/Integration/otds-proxy/token';
    return url;
};

const LoginPage = () => {
    const navigate = useNavigate();
    const reduceMotion = usePrefersReducedMotion();
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        repository: getDefaultRepository()
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showPassword, setShowPassword] = useState(false);
    const [authConfig, setAuthConfig] = useState(null);

    // Fetch environment-specific auth config from backend on component mount
    React.useEffect(() => {
        const fetchAuthConfig = async () => {
            try {
                const response = await api.get('/auth/config');
                if (response.data) {
                    setAuthConfig(response.data);
                    // Update formData with repository from backend
                    setFormData(prev => ({
                        ...prev,
                        repository: response.data.repository || prev.repository
                    }));
                }
            } catch (err) {
                console.error('[AUTH] Failed to fetch auth config from backend:', err);
                console.warn('[AUTH] Error details:', err.message);
                // Fallback to client-side detection if backend endpoint fails
            }
        };
        fetchAuthConfig();
    }, []);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setError(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            // Step 1: Authenticate with OTDS
            const params = new URLSearchParams();
            params.append('username', formData.username);
            params.append('password', formData.password);
            params.append('captcha_id', 'dev-no-captcha');
            params.append('captcha_answer', '0');

            // Use OTDS endpoint from backend config (priority) or fallback to client-side detection
            const otdsUrl = authConfig?.otdsTokenApiUrl || getOtdsUrl();
            const otdsResponse = await fetch(otdsUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: params.toString()
            });

            if (!otdsResponse.ok) {
                // Show user-friendly error message for authentication failures
                if (otdsResponse.status === 400 || otdsResponse.status === 401 || otdsResponse.status === 403) {
                    setError('Invalid username or password. Please try again.');
                } else {
                    const errorData = await otdsResponse.json().catch(() => ({}));
                    setError(errorData.message || 'Authentication service unavailable. Please try again later.');
                }
                return;
            }

            const otdsData = await otdsResponse.json();
            const token = otdsData.token || otdsData.access_token;

            if (!token) {
                setError('No token received from authentication service');
                return;
            }

            // Step 2: Store token and fetch user profile from backend
            localStorage.setItem('token', token);

            // Fetch user profile from backend with the OTDS token and username
            const userResponse = await api.get('/auth/profile', {
                params: { username: formData.username },
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (userResponse.data) {
                localStorage.setItem('user', JSON.stringify(userResponse.data));
                navigate('/dashboard');
            } else {
                setError('Failed to fetch user profile');
            }
        } catch (err) {
            console.error(err);
            if (err.response?.status === 401 || err.response?.status === 400) {
                setError('Invalid username or password. Please try again.');
            } else if (err.response?.data?.message) {
                setError(err.response.data.message);
            } else {
                setError('Service unavailable. Please check your connection and try again.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-[100dvh] flex font-sans text-ink">
            {/* Left Side - Brand Section — fixed brand green/white so the NABARD
                lockup reads identically in every theme (see `brand` in tailwind.config.js) */}
            <div className="hidden lg:flex w-[45%] bg-brand relative flex-col justify-between p-12 text-brand-foreground overflow-hidden">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-10"
                     style={{
                         backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
                         backgroundSize: '32px 32px'
                     }}>
                </div>

                {/* Decorative Circles */}
                <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full border border-brand-foreground/10" />
                <div className="absolute -bottom-10 -left-10 w-64 h-64 rounded-full border border-brand-foreground/10" />

                <div className="relative z-10">
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-foreground p-2 shadow-pop">
                            <img src={nabardLogo} alt="NABARD" className="h-full w-full object-contain" />
                        </div>
                        <span className="font-display text-2xl font-medium tracking-tight">NEO Admin</span>
                    </div>
                </div>

                <div className="relative z-10 max-w-sm">
                    <p className="font-display text-display-lg font-medium leading-tight">
                        A registry of record for NABARD.
                    </p>
                    <p className="mt-3 text-sm text-brand-foreground/70">
                        Cases, workflows, users and groups — one console for the people who keep them in order.
                    </p>
                </div>
            </div>

            {/* Right Side - Login Form */}
            <div className="flex-1 bg-paper flex flex-col justify-center items-center p-8 relative overflow-hidden">
                {/* Same dotted texture as the brand panel, echoed here in `ink` at low
                    opacity — ties the two halves together instead of leaving this side
                    a flat, empty wall (most noticeable in light mode). */}
                <div
                    className="pointer-events-none absolute inset-0 opacity-[0.08]"
                    style={{
                        backgroundImage: 'radial-gradient(circle at 2px 2px, rgb(var(--c-ink)) 1px, transparent 0)',
                        backgroundSize: '32px 32px',
                    }}
                />
                {/* Decorative rings, mirrored from the brand panel's bottom-left pair —
                    gives this side the same "designed" quality instead of bare paper. */}
                <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full border border-canopy/10" />
                <div className="absolute -bottom-10 -right-10 w-64 h-64 rounded-full border border-canopy/10" />
                {/* Brand-tinted halo, centred directly behind the card (the flex layout
                    centres the card at 50/50 of this panel) rather than floating above
                    it. Alpha-based against `canopy` — a tint-vs-paper colour diff is a
                    few RGB values apart in light mode and effectively invisible, while
                    an alpha glow shows up the same way in every theme. */}
                <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                        background: 'radial-gradient(ellipse 48% 52% at 50% 50%, rgb(var(--c-canopy) / 0.20) 0%, rgb(var(--c-canopy) / 0.08) 48%, transparent 76%)',
                    }}
                />
                <motion.div
                    initial={reduceMotion ? false : { opacity: 0, y: 15 }}
                    animate={reduceMotion ? false : { opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, ease: EASE_SMOOTH }}
                    className="relative w-full max-w-md bg-surface rounded-card border border-line shadow-[0_30px_80px_-25px_rgb(var(--c-canopy)/0.35)] p-8 md:p-10"
                >
                    {/* Full NABARD emblem on a fixed light backing (not the theme-aware
                        card surface) — the mark itself is dark line-art, so on a dark-mode
                        card it would wash out the same way the old small badge used to. */}
                    <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-foreground p-3 shadow-pop lg:hidden">
                        <img src={nabardLogo} alt="NABARD" className="h-full w-full object-contain" />
                    </div>
                    <div className="ledger-spine pl-4 mb-8">
                        <h2 className="font-display text-display font-medium text-ink">Sign in</h2>
                        <p className="mt-1 text-sm text-slate-500">Use your NEO credentials.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        
                        <div>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                    <Mail size={18} className="text-slate-400" />
                                </div>
                                <input
                                    id="username"
                                    type="text"
                                    name="username"
                                    value={formData.username}
                                    onChange={handleChange}
                                    className="block w-full pl-10 pr-3 py-2.5 bg-paper border border-line rounded-lg
                                             text-ink placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-canopy/20 focus:border-canopy
                                             transition-colors text-sm"
                                    placeholder="Username"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                    <Lock size={18} className="text-slate-400" />
                                </div>
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    className="block w-full pl-10 pr-10 py-2.5 bg-paper border border-line rounded-lg
                                             text-ink placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-canopy/20 focus:border-canopy
                                             transition-colors text-sm"
                                    placeholder="Password"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-ink transition-colors"
                                    title={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 rounded-lg bg-danger-tint border border-danger/20 text-danger text-xs font-medium flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-danger shrink-0" />
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full flex items-center justify-center py-2.5 px-4 rounded-lg shadow-sm text-sm font-semibold text-white
                                     bg-canopy hover:bg-canopy-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-canopy
                                     disabled:opacity-70 disabled:cursor-not-allowed transition-colors gap-2"
                        >
                            {isLoading ? (
                                <Loader2 className="animate-spin h-4 w-4" />
                            ) : (
                                <>
                                    <span>Sign In</span>
                                    <ArrowRight className="h-4 w-4" />
                                </>
                            )}
                        </button>
                    </form>


                </motion.div>

            </div>
        </div>
    );
};

export default LoginPage;
