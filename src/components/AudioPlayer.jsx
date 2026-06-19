import { useState, useEffect, useRef, useMemo } from "react";
import { Play, Pause } from "lucide-react";

/**
 * Shared AudioPlayer component to handle voice notes and other audio recordings.
 */
const AudioPlayer = ({ url, className = "" }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [hasInteracted, setHasInteracted] = useState(false);
    const audioRef = useRef(null);

    const cacheBustedUrl = useMemo(() => {
        if (!url) return url;
        if (url.startsWith('blob:')) return url;
        const separator = url.includes('?') ? '&' : '?';
        return `${url}${separator}cb=${Date.now()}`;
    }, [url]);

    const togglePlay = (e) => {
        if (e && e.stopPropagation) e.stopPropagation();

        if (!hasInteracted) {
            setHasInteracted(true);
            return;
        }

        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play().catch(err => {
                console.error("Playback failed:", err);
            });
        }
    };

    useEffect(() => {
        if (hasInteracted && audioRef.current && !isPlaying) {
            audioRef.current.play().catch(err => {
                console.error("Lazy Playback failed:", err);
            });
            setIsPlaying(true);
        }
    }, [hasInteracted]);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleEnded = () => setIsPlaying(false);
        const handlePause = () => setIsPlaying(false);
        const handlePlay = () => setIsPlaying(true);

        audio.addEventListener('ended', handleEnded);
        audio.addEventListener('pause', handlePause);
        audio.addEventListener('play', handlePlay);

        return () => {
            audio.removeEventListener('ended', handleEnded);
            audio.removeEventListener('pause', handlePause);
            audio.removeEventListener('play', handlePlay);
        };
    }, [hasInteracted]);

    return (
        <div className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg border transition-all duration-300 w-fit min-w-[120px] shadow-sm bg-white border-violet-100 hover:border-violet-200 hover:shadow-md ${isPlaying ? 'bg-violet-50/80 border-violet-300 scale-[1.02]' : ''} ${className}`}>
            <button
                type="button"
                onClick={togglePlay}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300 shadow-sm ${isPlaying
                    ? 'bg-gradient-to-r from-rose-500 to-pink-600'
                    : 'bg-gradient-to-r from-violet-500 to-fuchsia-600 hover:scale-110 active:scale-95'
                    }`}
            >
                {isPlaying ? (
                    <Pause size={12} className="text-white fill-white" />
                ) : (
                    <Play size={12} className="text-white fill-white ml-0.5" />
                )}
            </button>
            <div className="flex flex-col">
                <span className={`text-[9px] font-black uppercase tracking-[0.1em] ${isPlaying ? 'text-violet-700' : 'text-gray-400'}`}>
                    {isPlaying ? 'Playing...' : 'Voice Note'}
                </span>
                {isPlaying && (
                    <div className="flex gap-0.5 mt-0.5 h-1.5 items-center">
                        <div className="w-0.5 h-full bg-violet-400 animate-bounce" style={{ animationDuration: '0.6s' }}></div>
                        <div className="w-0.5 h-2/3 bg-violet-500 animate-bounce" style={{ animationDuration: '0.8s' }}></div>
                        <div className="w-0.5 h-full bg-violet-600 animate-bounce" style={{ animationDuration: '0.4s' }}></div>
                        <div className="w-0.5 h-2/3 bg-violet-500 animate-bounce" style={{ animationDuration: '0.7s' }}></div>
                    </div>
                )}
            </div>
            {hasInteracted && <audio ref={audioRef} src={cacheBustedUrl} className="hidden" preload="auto" />}
        </div>
    );
};

export default AudioPlayer;
