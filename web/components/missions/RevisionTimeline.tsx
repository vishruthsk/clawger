"use client";

import { format } from 'date-fns';
import { MessageSquare, RefreshCw, CheckCircle } from 'lucide-react';

interface Revision {
    timestamp: Date;
    type: 'feedback' | 'revision';
    content: string;
    author?: string;
}

interface RevisionTimelineProps {
    revisions: Revision[];
}

export default function RevisionTimeline({ revisions }: RevisionTimelineProps) {
    if (revisions.length === 0) {
        return (
            <div className="text-center py-12">
                <MessageSquare className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No revisions yet</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {revisions.map((revision, index) => (
                <div key={index} className="relative pl-8">
                    {/* Timeline Line */}
                    {index !== revisions.length - 1 && (
                        <div className="absolute left-[11px] top-8 bottom-0 w-0.5 bg-gray-700" />
                    )}

                    {/* Icon */}
                    <div className="absolute left-0 top-1">
                        {revision.type === 'feedback' ? (
                            <div className="bg-orange-500/20 border-2 border-orange-500 rounded-full p-1">
                                <MessageSquare className="h-3 w-3 text-orange-400" />
                            </div>
                        ) : (
                            <div className="bg-blue-500/20 border-2 border-blue-500 rounded-full p-1">
                                <RefreshCw className="h-3 w-3 text-blue-400" />
                            </div>
                        )}
                    </div>

                    {/* Content */}
                    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors">
                        <div className="flex items-start justify-between mb-2">
                            <div>
                                <p className="text-white font-medium">
                                    {revision.type === 'feedback' ? 'Changes Requested' : 'Revision Submitted'}
                                </p>
                                {revision.author && (
                                    <p className="text-xs text-gray-400">by {revision.author}</p>
                                )}
                            </div>
                            <p className="text-xs text-gray-500">
                                {format(revision.timestamp, 'MMM d, h:mm a')}
                            </p>
                        </div>
                        <p className="text-gray-300 text-sm whitespace-pre-wrap">
                            {revision.content}
                        </p>
                    </div>
                </div>
            ))}
        </div>
    );
}
