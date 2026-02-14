"use client";

import { useState } from 'react';
import { X, Star, MessageSquare, ShieldCheck, Target } from 'lucide-react';

interface RatingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (rating: number, feedback: string) => Promise<void>;
    agentName: string;
    missionTitle: string;
}

export default function RatingModal({
    isOpen,
    onClose,
    onSubmit,
    agentName,
    missionTitle
}: RatingModalProps) {
    const [rating, setRating] = useState(0);
    const [hoveredRating, setHoveredRating] = useState(0);
    const [feedback, setFeedback] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (rating === 0) return;

        setIsSubmitting(true);
        try {
            await onSubmit(rating, feedback);
            onClose();
            setRating(0);
            setFeedback('');
        } catch (error) {
            console.error('Failed to submit rating:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const ratingLabels = [
        'Poor Performance',
        'Below Expectations',
        'Met Expectations',
        'Exceeded Expectations',
        'Exceptional Execution'
    ];

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-[#0C0C0C] border border-white/10 rounded-[2rem] max-w-lg w-full p-8 shadow-2xl relative overflow-hidden group">

                {/* Background Effects */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[80px] pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/5 rounded-full blur-[60px] pointer-events-none" />
                <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-[0.03] pointer-events-none" />

                {/* Header */}
                <div className="flex items-start justify-between mb-8 relative z-10">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="px-2 py-0.5 rounded bg-primary/10 border border-primary/20 text-[10px] font-bold uppercase tracking-wider text-primary">
                                Mission Complete
                            </div>
                        </div>
                        <h3 className="text-2xl font-bold text-white tracking-tight">
                            Rate Agent Performance
                        </h3>
                        <p className="text-sm text-gray-400 mt-1">
                            Provide feedback on <span className="text-white font-medium">{agentName}</span>'s execution.
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/5 rounded-full border border-transparent hover:border-white/10 transition-all text-gray-400 hover:text-white"
                        disabled={isSubmitting}
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8 relative z-10">
                    {/* Mission Context */}
                    <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4 flex items-center gap-4">
                        <div className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center border border-white/10">
                            <Target className="w-5 h-5 text-gray-400" />
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-0.5">Mission Context</p>
                            <p className="text-sm text-gray-200 font-medium truncate">{missionTitle}</p>
                        </div>
                    </div>

                    {/* Star Rating */}
                    <div className="text-center">
                        <div className="flex justify-center items-center gap-3 mb-4">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    type="button"
                                    onClick={() => setRating(star)}
                                    onMouseEnter={() => setHoveredRating(star)}
                                    onMouseLeave={() => setHoveredRating(0)}
                                    className="relative group/star transition-transform hover:scale-110 focus:outline-none"
                                >
                                    <Star
                                        className={`w-10 h-10 transition-all duration-300 ${star <= (hoveredRating || rating)
                                                ? 'fill-primary text-primary drop-shadow-[0_0_10px_rgba(249,115,22,0.5)]'
                                                : 'text-gray-700 hover:text-gray-500'
                                            }`}
                                        strokeWidth={1.5}
                                    />
                                    {/* Star Glow Effect */}
                                    {star <= (hoveredRating || rating) && (
                                        <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full opacity-50 pointer-events-none" />
                                    )}
                                </button>
                            ))}
                        </div>

                        <div className="h-6">
                            {(hoveredRating || rating) > 0 ? (
                                <p className="text-sm font-medium text-primary animate-fade-in uppercase tracking-wide">
                                    {ratingLabels[(hoveredRating || rating) - 1]}
                                </p>
                            ) : (
                                <p className="text-sm text-gray-600">Select a rating</p>
                            )}
                        </div>
                    </div>

                    {/* Feedback */}
                    <div className="space-y-3">
                        <label className="flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-wider">
                            <span className="flex items-center gap-2">
                                <MessageSquare className="w-3 h-3" /> Qualitative Feedback
                            </span>
                            <span className={feedback.length > 0 ? "text-primary" : "text-gray-600"}>
                                {feedback.length} chars
                            </span>
                        </label>
                        <div className="relative group/input">
                            <textarea
                                value={feedback}
                                onChange={(e) => setFeedback(e.target.value)}
                                placeholder="Describe the agent's performance, communication, and output quality..."
                                className="w-full bg-[#0F0F0F] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-primary/50 focus:bg-white/[0.02] active:bg-white/[0.02] hover:border-white/20 resize-none transition-all duration-300 min-h-[120px] text-sm"
                                disabled={isSubmitting}
                            />
                            {/* Focus Glow */}
                            <div className="absolute inset-0 -z-10 bg-gradient-to-r from-primary/0 via-primary/5 to-primary/0 rounded-xl opacity-0 group-focus-within/input:opacity-100 transition-opacity duration-500 blur-md" />
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3.5 bg-white/5 hover:bg-white/10 text-gray-300 font-medium rounded-xl transition-all border border-transparent hover:border-white/5"
                            disabled={isSubmitting}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={rating === 0 || isSubmitting}
                            className="flex-[2] px-4 py-3.5 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_-5px_rgba(249,115,22,0.3)] hover:shadow-[0_0_30px_-5px_rgba(249,115,22,0.5)] flex items-center justify-center gap-2 group/btn relative overflow-hidden"
                        >
                            {isSubmitting ? (
                                <span className="flex items-center gap-2">
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Submitting
                                </span>
                            ) : (
                                <>
                                    <ShieldCheck className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
                                    Submit Review
                                </>
                            )}

                            {/* Shine Effect */}
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover/btn:animate-shimmer" />
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
