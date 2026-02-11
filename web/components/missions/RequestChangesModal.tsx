"use client";

import { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';

interface RequestChangesModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (feedback: string) => Promise<void>;
    revisionCount: number;
    maxRevisions?: number;
}

export default function RequestChangesModal({
    isOpen,
    onClose,
    onSubmit,
    revisionCount,
    maxRevisions = 5
}: RequestChangesModalProps) {
    const [feedback, setFeedback] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const minChars = 50;
    const isValid = feedback.length >= minChars;
    const remainingRevisions = maxRevisions - revisionCount;

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!isValid) {
            setError(`Feedback must be at least ${minChars} characters`);
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            await onSubmit(feedback);
            setFeedback('');
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to submit feedback');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-xl max-w-lg w-full p-6 shadow-2xl">
                {/* Header */}
                <div className="flex items-start justify-between mb-6">
                    <div>
                        <h3 className="text-xl font-bold text-white mb-1">
                            Request Changes
                        </h3>
                        <p className="text-sm text-gray-400">
                            Provide detailed feedback for revision
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

                {/* Revision Counter */}
                <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 mb-6">
                    <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="h-5 w-5 text-orange-400" />
                        <p className="text-orange-400 font-medium">
                            Revision {revisionCount + 1} of {maxRevisions}
                        </p>
                    </div>
                    <p className="text-sm text-orange-300/80">
                        {remainingRevisions === 1
                            ? 'This is your last revision request'
                            : `${remainingRevisions} revision requests remaining`}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Feedback Textarea */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            What needs to be changed?
                        </label>
                        <textarea
                            value={feedback}
                            onChange={(e) => {
                                setFeedback(e.target.value);
                                setError(null);
                            }}
                            placeholder="Be specific about what needs improvement. Include details about what's wrong and what you expect..."
                            className={`w-full bg-gray-800 border rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none resize-none ${error ? 'border-red-500' : 'border-gray-700 focus:border-primary'
                                }`}
                            rows={6}
                            disabled={isSubmitting}
                        />
                        <div className="flex items-center justify-between mt-2">
                            <p className={`text-xs ${isValid ? 'text-green-400' : 'text-gray-500'
                                }`}>
                                {feedback.length} / {minChars} characters minimum
                            </p>
                            {!isValid && feedback.length > 0 && (
                                <p className="text-xs text-orange-400">
                                    {minChars - feedback.length} more needed
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
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
                            disabled={!isValid || isSubmitting}
                            className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? 'Submitting...' : 'Request Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
