'use client';

import { Megaphone, X } from 'lucide-react';
import { useEffect, useState, useRef, Fragment } from 'react';
import { Button } from '@/components/ui/button';
import { NoticeViewDialog } from '@/components/admin/NoticeViewDialog';

interface Notice {
    id: number;
    title: string;
    content: string;
    createdAt: Date;
    author?: { name: string | null } | null;
}

interface NoticeMarqueeProps {
    notices: Notice[];
    speed?: number; // 애니메이션 속도 조절용 가중치 (기본값 1)
}

// 3일 이내면 NEW 뱃지 표시
const NEW_THRESHOLD_MS = 3 * 24 * 60 * 60 * 1000;

function formatMonthDay(date: Date | string) {
    const d = new Date(date);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${mm}-${dd}`;
}

function NoticeTicker({ notices }: { notices: Notice[] }) {
    const now = Date.now();
    return (
        <>
            {notices.map((n, i) => {
                const isNewest = i === 0;
                const isNew = isNewest && (now - new Date(n.createdAt).getTime() < NEW_THRESHOLD_MS);
                return (
                    <Fragment key={n.id}>
                        {i > 0 && (
                            <span className="mx-2 text-[#fdba74]" aria-hidden="true">•</span>
                        )}
                        {isNew && (
                            <span className="inline-flex items-center bg-red-500 text-white text-[9px] font-black px-1 py-[1px] rounded mr-1 tracking-wider align-middle">
                                NEW
                            </span>
                        )}
                        <span className={`font-mono mr-1 ${isNewest ? 'text-[#c2410c]/80' : 'text-[#f97316]/60'}`}>
                            [{formatMonthDay(n.createdAt)}]
                        </span>
                        <span className={isNewest
                            ? 'font-bold text-[#c2410c]'
                            : 'font-medium text-[#fb923c]'
                        }>
                            {n.title}
                        </span>
                    </Fragment>
                );
            })}
        </>
    );
}

export function NoticeMarquee({ notices, speed = 1 }: NoticeMarqueeProps) {
    const [isMounted, setIsMounted] = useState(false);
    const [isVisible, setIsVisible] = useState(true);
    const [isOverflowing, setIsOverflowing] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const textRef = useRef<HTMLSpanElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        // 텍스트가 컨테이너 범위를 넘어가는지(넘치는지) 체크해서, 넘칠 때만 마키를 적용
        const textEl = textRef.current;
        const containerEl = containerRef.current;
        if (!textEl || !containerEl) return;

        const check = () => {
            setIsOverflowing(textEl.scrollWidth > containerEl.clientWidth);
        };

        check();

        // 컨테이너/텍스트 크기 변경(리사이즈, 레이아웃 후속 변화) 시 재계산
        const ro = new ResizeObserver(check);
        ro.observe(textEl);
        ro.observe(containerEl);

        // 커스텀 폰트 로드가 끝나 글자 너비가 확정된 이후에도 재계산
        if (typeof document !== 'undefined' && 'fonts' in document) {
            document.fonts.ready.then(check).catch(() => { });
        }

        return () => {
            ro.disconnect();
        };
    }, [notices, isMounted]);

    // 서버 사이드 렌더링(또는 Hydration) 중에는 빈 공간만 예약 (깜빡임 방지)
    if (!isMounted || notices.length === 0) {
        return <div className="h-[36px] w-full"></div>;
    }

    if (!isVisible) return null;

    // 애니메이션 시간 계산용 총 글자 수 (날짜 prefix/구분자/NEW 뱃지 대략 포함)
    const totalLength = notices.reduce((acc, n) => acc + n.title.length + 12, 0);
    const duration = Math.max(15, (totalLength * 0.2) / speed);

    const handleNoticeClick = () => {
        if (notices.length > 0) {
            setCurrentIndex(0);
            setIsModalOpen(true);
        }
    };

    const handlePrev = () => {
        setCurrentIndex((prev) => (prev > 0 ? prev - 1 : notices.length - 1));
    };

    const handleNext = () => {
        setCurrentIndex((prev) => (prev < notices.length - 1 ? prev + 1 : 0));
    };

    const currentNotice = notices[currentIndex];

    return (
        <>
            <div className="w-full px-1.5 lg:px-0 group relative z-10 cursor-pointer" onClick={handleNoticeClick}>
                <div className="flex items-center w-full h-[36px] bg-[#fff7ed] border border-[#fed7aa] rounded-[8px] shadow-sm overflow-hidden pl-0 pr-2 transition-all hover:bg-[#ffedd5]">
                    
                    {/* 왼쪽 확성기 뱃지 (고정) */}
                    <div className="flex-shrink-0 flex items-center justify-center gap-1.5 z-10 bg-white/80 pr-2 pl-3 h-full border-r border-[#fed7aa]/50 shadow-[4px_0_8px_-4px_rgba(254,215,170,0.5)]">
                        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-orange-100 text-[#ea580c]">
                            <Megaphone className="w-3 h-3" />
                        </div>
                        <span className="text-[11px] font-black text-[#ea580c] tracking-tight whitespace-nowrap">
                            알림
                        </span>
                    </div>

                    {/* 흐르는/고정 텍스트 영역 */}
                    <div ref={containerRef} className={`flex-1 min-w-0 overflow-hidden relative flex items-center h-full ${isOverflowing ? 'mask-gradient' : ''}`}>
                        <div 
                            className={`flex whitespace-nowrap will-change-transform ${isOverflowing ? 'group-hover:[animation-play-state:paused] hover:[animation-play-state:paused]' : ''}`}
                            style={isOverflowing ? { animation: `marquee ${duration}s linear infinite` } : {}}
                        >
                            {/* 텍스트 내용 */}
                            <span ref={textRef} className="text-[12px] sm:text-[12.5px] px-1 pb-[1px] whitespace-nowrap shrink-0">
                                <NoticeTicker notices={notices} />
                            </span>
                            {/* 배열의 끝에서 공백 없이 이어지게 하기 위해 내용 복제본 (넘칠 때만) */}
                            {isOverflowing && (
                               <span className="text-[12.5px] px-4 pb-[1px] whitespace-nowrap shrink-0" aria-hidden="true">
                                   <NoticeTicker notices={notices} />
                               </span>
                            )}
                        </div>
                    </div>

                    {/* 닫기 버튼 */}
                    <div className="flex-shrink-0 z-10 pl-2 flex items-center ml-auto border-l border-[#ffedd5]/50">
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsVisible(false);
                            }}
                            className="p-1 rounded-md text-[#f97316] hover:bg-[#fed7aa] hover:text-[#c2410c] transition-colors -mr-1"
                            aria-label="공지 닫기"
                        >
                            <X className="w-[14px] h-[14px]" strokeWidth={2.5} />
                        </button>
                    </div>
                </div>
            </div>

            {/* 공지사항 상세 팝업 (모달) */}
            <NoticeViewDialog
                notice={currentNotice ? {
                    ...currentNotice,
                    authorName: currentNotice.author?.name
                } : null}
                notices={notices.map(n => ({
                    id: n.id,
                    title: n.title,
                    content: n.content,
                    createdAt: n.createdAt,
                    authorName: n.author?.name ?? null
                }))}
                open={isModalOpen}
                onClose={() => setIsModalOpen(false)}
            />
        </>
    );
}
