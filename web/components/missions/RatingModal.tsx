"use client";

import { useState } from 'react';
import { X, Star } from 'lucide-react';

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
        'Poor',
        'Below Average',
        'Average',
        'Good',
        'Excellent'
    ];

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-xl max-w-md w-full p-6 shadow-2xl">
                {/* Header */}
                <div className="flex items-start justify-between mb-6">
                    <div>
                        <h3 className="text-xl font-bold text-white mb-1">
                            Rate Mission
                        </h3>
                        <p className="text-sm text-gray-400">
                            How was your experience with {agentName}?
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-gray-800 rounded transition-colors"
                        disabled={isSubmitting}
                    >
                        <X className="h-5 w-5 text-gray-400" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Mission Title */}
                    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                        <p className="text-xs text-gray-400 mb-1">Mission</p>
                        <p className="text-white font-medium">{missionTitle}</p>
                    </div>

                    {/* Star Rating */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-3">
                            Rating
                        </label>
                        <div className="flex items-center gap-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    type="button"
                                    onClick={() => setRating(star)}
                                    onMouseEnter={() => setHoveredRating(star)}
                                    onMouseLeave={() => setHoveredRating(0)}
                                    className="transition-transform hover:scale-110"
                                >
                                    <Star
                                        className={`h-10 w-10 transition-colors ${star <= (hoveredRating || rating)
                                                ? 'fill-yellow-400 text-yellow-400'
                                                : 'text-gray-600'
                                            }`}
                                    />
                                </button>
                            ))}
                        </div>
                        {(hoveredRating || rating) > 0 && (
                            <p className="text-sm text-gray-400 mt-2">
                                {ratingLabels[(hoveredRating || rating) - 1]}
                            </p>
                        )}
                    </div>

                    {/* Feedback */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Feedback <span className="text-gray-500">(Optional)</span>
                        </label>
                        <textarea
                            value={feedback}
                            onChange={(e) => setFeedback(e.target.value)}
                            placeholder="Share your experience with this agent..."
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-primary resize-none"
                            rows={4}
                            disabled={isSubmitting}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            {feedback.length} characters
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
                            disabled={isSubmitting}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={rating === 0 || isSubmitting}
                            className="flex-1 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? 'Submitting...' : 'Submit Rating'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
