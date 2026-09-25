import React, { useId } from 'react';
import {
  Home,
  PlusCircle,
  DoorOpen,
  Shield,
  Check,
  ChevronLeft,
  Copy,
  Users,
  X,
  Loader2,
} from 'lucide-react';
import type { Room, Member } from '../types';
import { toPersianDigits } from '../lib/calculations';

interface MyRoomsModalProps {
  isOpen: boolean;
  onClose: () => void;
  canClose?: boolean;
  userRooms: { room: Room; member: Member }[];
  currentRoomId: string;
  onSelectRoom: (roomId: string) => void;
  onOpenCreateRoom: () => void;
  onOpenJoinRoom: () => void;
  isLoading?: boolean;
}

export const MyRoomsModal: React.FC<MyRoomsModalProps> = ({
  isOpen,
  onClose,
  canClose = true,
  userRooms,
  currentRoomId,
  onSelectRoom,
  onOpenCreateRoom,
  onOpenJoinRoom,
  isLoading = false,
}) => {
  const modalTitleId = useId();
  const [copiedCodeId, setCopiedCodeId] = React.useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (e: React.MouseEvent, inviteCode: string, roomId: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(inviteCode);
    setCopiedCodeId(roomId);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={modalTitleId}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-lg bg-[#141d38] border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-slate-800 bg-[#172242]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-emerald-500/20 shrink-0">
                <Home className="w-5 h-5 text-slate-950" />
              </div>
              <div>
                <h2 id={modalTitleId} className="text-base font-extrabold text-white">
                  اتاق‌های من ({toPersianDigits(userRooms.length)})
                </h2>
                <p className="text-xs text-slate-400">
                  اتاق‌های مشترکی که در آن‌ها عضویت دارید
                </p>
              </div>
            </div>

            {canClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
                aria-label="بستن"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Quick Action CTAs */}
          <div className="grid grid-cols-2 gap-2 mt-4">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenCreateRoom();
              }}
              className="py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20 flex items-center justify-center gap-1.5 transition-all"
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
              className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
            >
              <DoorOpen className="w-4 h-4 text-emerald-400" />
              <span>ورود با کد دعوت</span>
            </button>
          </div>
        </div>

        {/* Room List Content */}
        <div className="p-6 overflow-y-auto space-y-3 flex-1">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-400 mb-2" />
              <span className="text-xs">در حال بارگذاری لیست اتاق‌ها...</span>
            </div>
          ) : userRooms.length === 0 ? (
            <div className="text-center py-10 space-y-3 bg-[#0b132b]/50 border border-slate-800 rounded-2xl p-6">
              <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700 mx-auto flex items-center justify-center text-slate-400">
                <Users className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-white">هنوز در هیچ اتاقی عضو نیستید</h4>
              <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                می‌توانید با استفاده از کد دعوت به اتاق هم‌اتاقی‌های خود بپیوندید یا یک اتاق جدید بسازید.
              </p>
            </div>
          ) : (
            userRooms.map(({ room, member }) => {
              const isActive = room.id === currentRoomId;

              return (
                <div
                  key={room.id}
                  onClick={() => {
                    onSelectRoom(room.id);
                    onClose();
                  }}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isActive
                      ? 'bg-emerald-950/20 border-emerald-500/40 shadow-sm'
                      : 'bg-[#0b132b]/80 border-slate-700/60 hover:border-slate-500 hover:bg-[#0b132b]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shrink-0 bg-gradient-to-br ${
                        member.color || (isActive ? 'from-emerald-500 to-teal-600' : 'from-slate-700 to-slate-800')
                      }`}
                    >
                      <Home className="w-5 h-5" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-white truncate">
                          {room.name}
                        </span>
                        {isActive && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            اتاق فعال
                          </span>
                        )}
                        {member.isAdmin && (
                          <span className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            <Shield className="w-2.5 h-2.5" />
                            مدیر
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                        <button
                          type="button"
                          onClick={(e) => handleCopy(e, room.inviteCode, room.id)}
                          className="flex items-center gap-1 hover:text-emerald-400 transition-colors bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/60 text-[11px] font-mono"
                          title="کپی کد دعوت"
                        >
                          <span>{room.inviteCode}</span>
                          {copiedCodeId === room.id ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                        <span>•</span>
                        <span className="text-[11px]">نقش شما: {member.name}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <ChevronLeft
                      className={`w-5 h-5 ${
                        isActive ? 'text-emerald-400' : 'text-slate-500 group-hover:text-slate-300'
                      }`}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
