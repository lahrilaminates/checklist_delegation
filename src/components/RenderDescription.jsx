import React, { useState } from 'react';
import { Play, FileText, Image as ImageIcon, Link as LinkIcon, X, Maximize2, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AudioPlayer from './AudioPlayer';

const getYouTubeId = (url) => {
    if (!url || typeof url !== 'string') return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
};

const MediaViewer = ({ isOpen, onClose, media }) => {
    const isYoutube = media.type === 'youtube';
    const isVideo = media.type === 'video';
    const isImage = media.type.startsWith('image') || media.type === 'image';
    const isPdf = media.type === 'pdf' || (media.url && media.url.toLowerCase().endsWith('.pdf'));

    return (
        <AnimatePresence>
            {isOpen && (
                <div key="media-viewer-container" className="fixed inset-0 z-[10000] flex items-center justify-center p-4 md:p-8">
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/95 backdrop-blur-md"
                    />
                    
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95, y: 30 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 30 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="relative w-full max-w-5xl max-h-full bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-white/20"
                    >
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-10">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-xl ${isYoutube ? 'bg-red-50 text-red-600' : isVideo ? 'bg-indigo-50 text-indigo-600' : isImage ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                                    {isYoutube ? <Play size={18} fill="currentColor" /> : 
                                    isVideo ? <Play size={18} fill="currentColor" /> : 
                                    isImage ? <ImageIcon size={18} /> : 
                                    <FileText size={18} />}
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-xs font-black text-gray-400 uppercase tracking-widest leading-none mb-1">
                                        {isYoutube ? 'YouTube Content' : isVideo ? 'Video Content' : isImage ? 'Image Content' : 'Document Content'}
                                    </span>
                                    <span className="text-sm font-black text-gray-900 truncate max-w-[200px] sm:max-w-md">
                                        {media.url.split('/').pop().split('?')[0]}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => window.open(media.url, '_blank')}
                                    className="p-2.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-all group lg:flex items-center gap-2 hidden"
                                    title="Open in new tab"
                                >
                                    <span className="text-xs font-bold uppercase tracking-wider">Expand</span>
                                    <ExternalLink size={18} />
                                </button>
                                <button 
                                    onClick={onClose}
                                    className="p-2.5 text-gray-500 hover:text-rose-600 hover:bg-rose-50 rounded-2xl transition-all"
                                >
                                    <X size={22} className="stroke-[2.5]" />
                                </button>
                            </div>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-grow overflow-auto flex items-center justify-center bg-[#0a0a0a] min-h-[40vh] relative group">
                            {isYoutube ? (
                                <div className="w-full aspect-video max-h-[80vh]">
                                    <iframe
                                        key={media.ytId || 'yt'}
                                        src={`https://www.youtube.com/embed/${media.ytId}?autoplay=1&rel=0&modestbranding=1`}
                                        className="w-full h-full border-none shadow-2xl"
                                        title="YouTube Video"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                        allowFullScreen
                                    />
                                </div>
                            ) : isVideo ? (
                                <video 
                                    key={media.url || 'vid'}
                                    src={media.url} 
                                    controls 
                                    autoPlay 
                                    className="max-w-full max-h-[80vh] shadow-2xl"
                                />
                            ) : isImage ? (
                                <img 
                                    src={media.url} 
                                    alt="Shared Media" 
                                    className="max-w-full max-h-[80vh] object-contain shadow-2xl select-none"
                                    onContextMenu={(e) => e.preventDefault()}
                                />
                            ) : (
                                <iframe 
                                    key={media.url || 'doc'}
                                    src={media.url} 
                                    className="w-full h-[80vh] bg-white border-none shadow-2xl"
                                    title="Document Viewer"
                                />
                            )}
                            
                            {/* Overlay Controls Hint for Image/Video */}
                            {(isImage || isVideo) && (
                                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                                    <div className="px-4 py-2 bg-black/50 backdrop-blur-md rounded-full border border-white/10 flex items-center gap-3">
                                        <div className="flex items-center gap-1.5 px-2 border-r border-white/20">
                                            <Maximize2 size={12} className="text-white" />
                                            <span className="text-[10px] font-bold text-white uppercase tracking-widest whitespace-nowrap">Full Gallery View</span>
                                        </div>
                                        <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest whitespace-nowrap">Scroll to Zoom</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

const RenderDescription = ({ text, audioUrl, instructionUrl, instructionType }) => {
    const [viewerOpen, setViewerOpen] = useState(false);
    const [viewerMedia, setViewerMedia] = useState({ url: '', type: '', ytId: '' });

    if (!text && !audioUrl && !instructionUrl) return <span className="text-gray-400">—</span>;

    const urlRegex = /(https?:\/\/[^\s]+(?:voice-notes|audio-recordings)[^\s]*\.(?:mp3|wav|ogg|webm|m4a|aac)(\?.*)?)/i;
    let match = null;
    if (text && typeof text === 'string') {
        match = text.match(urlRegex);
    }

    let url = audioUrl || (match ? match[0] : null);
    let cleanText = text || '';

    if (match && !audioUrl) {
        cleanText = text.replace(match[0], '')
            .replace(/Voice Note Link:/i, '')
            .replace(/Voice Note:/i, '')
            .trim();
    }

    const openViewer = (url, type) => {
        const ytId = getYouTubeId(url);
        if (ytId) {
            setViewerMedia({ url, type: 'youtube', ytId });
            setViewerOpen(true);
            return;
        }

        if (type === 'link') {
            window.open(url, '_blank');
            return;
        }
        setViewerMedia({ url, type });
        setViewerOpen(true);
    };

    const renderInstruction = () => {
        if (!instructionUrl || !instructionType || instructionType === 'none') return null;
        let urls = [];
        let types = [];
        try {
            urls = JSON.parse(instructionUrl);
            types = JSON.parse(instructionType);
            if (!Array.isArray(urls)) {
                urls = [instructionUrl];
                types = [instructionType];
            }
        } catch (e) {
            urls = [instructionUrl];
            types = [instructionType];
        }

        return (
            <div className="flex flex-wrap gap-2 mt-2">
                {urls.map((attachmentUrl, idx) => {
                    const type = types[idx] || 'link';
                    const ytId = getYouTubeId(attachmentUrl);
                    
                    let iconLabel = "Reference";
                    let Icon = LinkIcon;
                    let colorClass = "text-indigo-700 bg-indigo-50 border-indigo-100";

                    if (type === 'video' || ytId) {
                        iconLabel = "Video";
                        Icon = Play;
                        if (ytId) colorClass = "text-red-700 bg-red-50 border-red-100";
                    } else if (type === 'image') {
                        iconLabel = "Image";
                        Icon = ImageIcon;
                        colorClass = "text-emerald-700 bg-emerald-50 border-emerald-100";
                    } else if (type === 'pdf') {
                        iconLabel = "Doc/PDF";
                        Icon = FileText;
                        colorClass = "text-blue-700 bg-blue-50 border-blue-100";
                    }

                    return (
                        <button
                            key={idx}
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                openViewer(attachmentUrl, type);
                            }}
                            className={`flex items-center gap-1.5 text-[10px] sm:text-xs font-black uppercase tracking-tight border px-2.5 py-1.5 rounded-xl hover:shadow-lg hover:scale-105 active:scale-95 transition-all shadow-sm w-fit ${colorClass}`}
                            title={`View ${iconLabel}`}
                        >
                            <Icon size={12} strokeWidth={3} className={ytId ? 'fill-current' : ''} />
                            {iconLabel}
                        </button>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="flex flex-col min-w-[180px] max-w-full">
            {cleanText && (
                <span className="whitespace-pre-wrap text-[13px] font-medium text-gray-800 leading-relaxed mb-1.5">
                    {cleanText}
                </span>
            )}
            
            <div className="flex flex-wrap items-center gap-2">
                {url && <AudioPlayer className="!min-w-0" url={url} />}
                {renderInstruction()}
            </div>

            <MediaViewer 
                isOpen={viewerOpen} 
                onClose={() => setViewerOpen(false)} 
                media={viewerMedia} 
            />
        </div>
    );
};

export { MediaViewer };
export default RenderDescription;
