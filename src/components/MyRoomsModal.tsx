import React, { useState } from 'react';
import {
  DoorOpen,
  PlusCircle,
  KeyRound,
  Users,
  Check,
  Copy,
  Shield,
  X,
  ChevronLeft,
} from 'lucide-react';
import type { UserRoomMembership } from '../types';
import { toPersianDigits } from '../lib/calculations';

interface MyRoomsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userRooms: UserRoomMembership[];
  activeRoomId: string;
  onSelectRoom: (roomId: string) => void;
  onOpenCreateRoom: () => void;
  onOpenJoinRoom: () => void;
  userName: string;
}

export const MyRoomsModal: React.FC<MyRoomsModalProps> = ({
  isOpen,
  onClose,
  userRooms,
  activeRoomId,
  onSelectRoom,
  onOpenCreateRoom,
  onOpenJoinRoom,
  userName,
}) => {
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (e: React.MouseEvent, inviteCode: string, roomId: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(inviteCode);
    setCopiedCodeId(roomId);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="bg-[#141d38] border border-slate-700/80 w-full max-w-lg rounded-3xl shadow-2xl shadow-black/60 overflow-hidden flex flex-col max-h-[90vh]"
        dir="rtl"
      >
        {/* Header */}
        <div className="relative bg-gradient-to-b from-[#1b264a] to-[#141d38] p-6 pb-4 border-b border-slate-700/50">
          <button
            type="button"
            onClick={onClose}
            className="absolute left-4 top-4 p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800/60 transition-colors"
            aria-label="بستن"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-emerald-500/20 shrink-0">
              <DoorOpen className="w-6 h-6 text-slate-950" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">اتاق‌های من</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                حساب کاربری: <span className="text-emerald-400 font-semibold">{userName}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Room List or Empty State */}
        <div className="p-6 overflow-y-auto space-y-3 flex-1">
          {userRooms.length === 0 ? (
            <div className="text-center py-8 px-4 bg-[#0b132b]/60 rounded-2xl border border-slate-800">
              <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-400 mx-auto mb-3">
                <DoorOpen className="w-8 h-8" />
              </div>
              <h4 className="text-base font-bold text-white mb-1">
                هنوز در هیچ اتاقی عضو نیستید
              </h4>
              <p className="text-xs text-slate-400 max-w-xs mx-auto mb-6">
                می‌توانید یک اتاق جدید برای خود و هم‌اتاقی‌هایتان بسازید یا با کد دعوت وارد اتاق شوید.
              </p>
              <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenCreateRoom();
                  }}
                  className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20 transition-all flex items-center justify-center gap-1.5"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>ساخت اتاق جدید</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenJoinRoom();
                  }}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 transition-all flex items-center justify-center gap-1.5"
                >
                  <KeyRound className="w-4 h-4 text-emerald-400" />
                  <span>ورود با کد دعوت</span>
                </button>
              </div>
            </div>
          ) : (
            userRooms.map(({ room, member, membersCount }) => {
              const isActive = room.id === activeRoomId;
              const isCopied = copiedCodeId === room.id;

              return (
                <div
                  key={room.id}
                  onClick={() => {
                    onSelectRoom(room.id);
                    onClose();
                  }}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 group ${
                    isActive
                      ? 'bg-emerald-500/10 border-emerald-500/50 shadow-md shadow-emerald-500/10'
                      : 'bg-[#0b132b]/80 border-slate-700/70 hover:border-slate-600 hover:bg-[#0b132b]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                        isActive
                          ? 'bg-emerald-500 text-slate-950 shadow-sm shadow-emerald-500/30'
                          : 'bg-slate-800 text-slate-300 group-hover:bg-slate-700'
                      }`}
                    >
                      {room.name.slice(0, 1)}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors truncate">
                          {room.name}
                        </h4>
                        {isActive && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            اتاق فعال
                          </span>
                        )}
                        {member.isAdmin && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                            <Shield className="w-2.5 h-2.5 text-amber-400" />
                            مدیر
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-400 flex-wrap">
                        <span className="flex items-center gap-1 text-[11px]">
                          <Users className="w-3 h-3 text-slate-500" />
                          {toPersianDigits(membersCount)} هم‌اتاقی
                        </span>
                        <span>•</span>
                        <button
                          type="button"
                          onClick={(e) => handleCopy(e, room.inviteCode, room.id)}
                          className="flex items-center gap-1 hover:text-emerald-400 text-[11px] bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700/60"
                          title="کپی کد دعوت"
                        >
                          <span>کد: {room.inviteCode}</span>
                          {isCopied ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3 text-slate-400" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-slate-400 group-hover:text-emerald-400 shrink-0 transition-colors">
                    <ChevronLeft className="w-5 h-5" />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Quick Actions Footer */}
        <div className="p-4 bg-[#0b132b] border-t border-slate-800 flex items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenCreateRoom();
            }}
            className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20 transition-all flex items-center justify-center gap-1.5"
          >
            <PlusCircle className="w-4 h-4" />
            <span>ساخت اتاق جدید</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenJoinRoom();
            }}
            className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
          >
            <KeyRound className="w-4 h-4 text-emerald-400" />
            <span>ورود با کد دعوت</span>
          </button>
        </div>
      </div>
    </div>
  );
};
