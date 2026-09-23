import React from 'react';
import {
  History,
  PlusCircle,
  CheckCircle2,
  ArrowLeftRight,
  UserPlus,
  Trash2,
  Clock,
} from 'lucide-react';
import type { ActivityLog, Member } from '../types';
import { formatRelativeTime } from '../lib/calculations';

interface ActivityFeedProps {
  logs: ActivityLog[];
  members: Member[];
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ logs, members }) => {
  const getMember = (id: string) => members.find((m) => m.id === id);

  // Sort descending by timestamp
  const sortedLogs = [...logs].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const getLogIcon = (type: ActivityLog['type']) => {
    switch (type) {
      case 'expense_added':
        return <PlusCircle className="w-4 h-4 text-emerald-400" />;
      case 'settlement_confirmed':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'settlement_requested':
        return <ArrowLeftRight className="w-4 h-4 text-indigo-400" />;
      case 'member_joined':
        return <UserPlus className="w-4 h-4 text-blue-400" />;
      case 'expense_deleted':
        return <Trash2 className="w-4 h-4 text-rose-400" />;
      default:
        return <History className="w-4 h-4 text-slate-400" />;
    }
  };

  if (logs.length === 0) {
    return (
      <div className="bg-[#141d38] border border-slate-700/60 rounded-2xl p-6 text-center text-xs text-slate-400">
        هیچ رخداد و فعالیتی تاکنون ثبت نشده است.
      </div>
    );
  }

  return (
    <div className="bg-[#141d38] border border-slate-700/60 rounded-2xl p-4 sm:p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-700/50">
        <History className="w-4 h-4 text-slate-400" />
        <h3 className="text-sm font-bold text-white">گزارش و رخدادهای اخیر اتاق</h3>
      </div>

      <div className="space-y-3">
        {sortedLogs.map((log) => {
          const user = getMember(log.userId);

          return (
            <div
              key={log.id}
              className="flex items-start gap-3 p-3 rounded-xl bg-[#0b132b]/60 border border-slate-800/80 text-xs text-slate-300"
            >
              <div className="p-1.5 rounded-lg bg-slate-800/80 border border-slate-700 shrink-0 mt-0.5">
                {getLogIcon(log.type)}
              </div>

              <div className="flex-1 min-w-0">
                <p className="leading-relaxed text-slate-200">{log.description}</p>
                <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-500">
                  <Clock className="w-3 h-3" />
                  <span>{formatRelativeTime(log.timestamp)}</span>
                  {user && <span>• توسط {user.name}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
