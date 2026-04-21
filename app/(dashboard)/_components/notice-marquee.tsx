'use client';

import { Megaphone, X } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
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
        if (textRef.current && containerRef.current) {
            setIsOverflowing(textRef.current.scrollWidth > containerRef.current.clientWidth);
        }
    }, [notices, isMounted]);

    // 서버 사이드 렌더링(또는 Hydration) 중에는 빈 공간만 예약 (깜빡임 방지)
    if (!isMounted || notices.length === 0) {
        return <div className="h-[36px] w-full"></div>;
    }

    if (!isVisible) return null;

    // 공지들을 하나의 긴 문장으로 잇기
    const joinedNotice = notices.map(n => n.title).join(' 　•　 ');
    
    // speed 값에 따라 애니메이션 시간 동적 계산 (예: 짧은 글씨면 15초, 길면 더 길게)
    // 기본적으로 글자 수에 비례해서 무한 스크롤 속도를 일정하게 유지합니다.
    const duration = Math.max(15, (joinedNotice.length * 0.2) / speed);

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
                            <span ref={textRef} className="text-[12px] sm:text-[12.5px] font-semibold text-[#c2410c] px-1 pb-[1px] whitespace-nowrap shrink-0">
                                {joinedNotice}
                            </span>
                            {/* 배열의 끝에서 공백 없이 이어지게 하기 위해 내용 복제본 (넘칠 때만) */}
                            {isOverflowing && (
                               <span className="text-[12.5px] font-semibold text-[#c2410c] px-4 pb-[1px] whitespace-nowrap shrink-0" aria-hidden="true">
                                   {joinedNotice}
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
